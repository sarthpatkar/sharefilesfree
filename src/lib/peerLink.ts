// One WebRTC connection to one peer, and everything that has to be right about
// it.
//
// This was extracted out of peerTransfer.ts when group sharing arrived, because
// a group sender holds up to twenty of these at once while a 1:1 transfer holds
// exactly one. Nothing here changed in the move — the reasoning in the comments
// below was paid for by real bugs and real relay bills, and it is shared rather
// than copied precisely so a fix to any of it lands in both features at once.
//
// What this file does NOT know about: room codes, the signaling socket, or how
// many peers exist. It is handed signal data and hands signal data back; the
// orchestrator above it decides where those go. That seam is what lets the same
// engine serve one peer or twenty.

import { deriveVerificationCode, fingerprintFromSdp } from "./verificationCode";
import { countMetric } from "./metrics";

// Chunk size is negotiated, not guessed. SCTP tells us the real per-message
// ceiling for this pair via pc.sctp.maxMessageSize (Chrome reports 256KB,
// Firefox far more); 16KB was the safe floor for browsers that don't. Sending
// 16KB messages when 256KB are allowed costs 16x the message count, and each
// message carries its own SCTP overhead and event-loop turn — which is most of
// why a 29MB file crawled.
const CHUNK_FLOOR = 16 * 1024;
const CHUNK_CEILING = 256 * 1024;

// The file is read in slices this large and then sent as chunks carved out of
// that one buffer. Previously every single 16KB chunk cost its own
// Blob.slice().arrayBuffer() — roughly 1,850 async disk reads for a 29MB file,
// which dominated the transfer time. Now that's 8 reads.
export const READ_SLICE_SIZE = 4 * 1024 * 1024;

// Stop reading more chunks once the channel's send buffer backs up past
// this many bytes, and resume once it drains below it. Without this a fast
// sender can balloon browser memory / overwhelm a TURN relay.
export const BUFFERED_AMOUNT_HIGH_WATERMARK = 8 * 1024 * 1024; // 8MB
export const BUFFERED_AMOUNT_LOW_WATERMARK = 2 * 1024 * 1024; // 2MB

// Chrome's data channel has a hard send-queue ceiling of 16MB, and send()
// THROWS once buffered data passes it — "RTCDataChannel send queue is full",
// reproduced while benchmarking watermarks. The watermarks above stay well
// under it, but "well under" is an argument, not a guarantee: a stalled
// bufferedamountlow event would walk us into an exception that aborts a
// transfer mid-file. This is the guarantee.
const BUFFERED_AMOUNT_HARD_CEILING = 12 * 1024 * 1024;

// Progress used to fire once per chunk — ~1,850 React state updates for a
// 29MB file, each one a re-render competing with the transfer for the main
// thread. The UI cannot show more than a few updates a second anyway.
const PROGRESS_INTERVAL_MS = 60;

// How long a "disconnected" peer connection is given to recover before the user
// is told anything. The state is transient by specification — ICE re-checks
// paths and frequently recovers — so announcing it immediately turned an
// ordinary wifi wobble into a failure message over a transfer that was still
// running. Ten seconds is well past a normal recovery and well short of a user
// concluding the page has hung.
const DISCONNECT_GRACE_MS = 10 * 1000;

// TURN credentials are fetched fresh per session from our own API rather
// than baked into the client bundle — see /api/turn-credentials for why a
// hardcoded NEXT_PUBLIC_ credential would be an open invitation to abuse.
const FALLBACK_STUN: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:global.stun.twilio.com:3478"] },
];

/**
 * Never allowed to block a connection for long.
 *
 * This runs before `new RTCPeerConnection()` exists, so however long it takes is
 * added to every transfer on both sides. The server-side route caches its
 * upstream call now, but a hung request here — a dead origin, a captive portal,
 * a phone losing signal mid-fetch — would still stall the whole transfer with
 * no timeout of its own. STUN-only connects the large majority of peers, so
 * giving up quickly is strictly better than waiting.
 */
const ICE_SERVERS_TIMEOUT_MS = 3000;

/**
 * One ICE configuration per transfer, however many peers it has.
 *
 * The fetch used to live inside the peer-connection constructor, which was
 * fine when there was exactly one of those. A group sender builds up to twenty,
 * and twenty calls to /api/turn-credentials — each one able to add up to three
 * seconds in front of a connection — is latency and load bought for nothing:
 * every peer gets the same answer. Memoised on the promise rather than the
 * result, so twenty links opening at once still share a single request.
 */
export function createIceServerProvider(): () => Promise<RTCIceServer[]> {
  let cached: Promise<RTCIceServer[]> | null = null;
  return () => {
    if (!cached) {
      cached = (async () => {
        try {
          const res = await fetch("/api/turn-credentials", { signal: AbortSignal.timeout(ICE_SERVERS_TIMEOUT_MS) });
          const data = await res.json();
          // Cloudflare's response already includes its own STUN servers alongside
          // the TURN ones, so when it's configured we don't need the fallback list too.
          if (data.turnConfigured) return data.iceServers as RTCIceServer[];
        } catch {
          // TURN is a reliability enhancement, not a hard requirement — fall back to STUN-only
          // (works fine for most home networks; only strict corporate NATs really need TURN).
        }
        return FALLBACK_STUN;
      })();
    }
    return cached;
  };
}

export type SignalData =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

export type ControlMessage =
  | { type: "file-start"; id: string; name: string; size: number; mime: string }
  | { type: "file-end"; id: string }
  | { type: "batch-end" };

export interface FileProgress {
  id: string;
  name: string;
  size: number;
  sent: number;
}

/**
 * How much buffer and how large a read this link may use right now.
 *
 * A 1:1 transfer returns the constants above and is done. A group sender
 * divides them by the number of links it currently has open, and the reason is
 * arithmetic rather than taste: twenty links at an 8MB high watermark is up to
 * 160MB of buffered bytes on the sending device, and twenty concurrent 4MB
 * slice reads is another 80MB transient on top. Both are per-link budgets that
 * were only ever sized for one link.
 *
 * It is a function rather than a value because links open and close while a
 * transfer runs: a device that joins late must not be handed a share of the
 * budget calculated before it existed.
 */
export interface LinkTuning {
  highWatermark: number;
  lowWatermark: number;
  readSlice: number;
}

export const DEFAULT_TUNING: LinkTuning = {
  highWatermark: BUFFERED_AMOUNT_HIGH_WATERMARK,
  lowWatermark: BUFFERED_AMOUNT_LOW_WATERMARK,
  readSlice: READ_SLICE_SIZE,
};

export interface PeerLinkCallbacks {
  /** Outbound signalling. The orchestrator decides how this reaches the peer. */
  onSignal: (data: SignalData) => void;
  /** The data channel is open and usable. */
  onOpen?: () => void;
  onClose?: () => void;
  /** A message off the data channel: a control frame (string) or a chunk. */
  onData?: (data: string | ArrayBuffer) => void;
  onProgress?: (progress: FileProgress) => void;
  onError?: (message: string) => void;
  /**
   * The short code both devices derive from the two connection keys, once they
   * are connected. Identical on both ends when nobody is in the middle,
   * different when somebody is — see verificationCode.ts.
   */
  onVerificationCode?: (code: string) => void;
  /**
   * ICE has finished: no further candidates exist to trade. The orchestrator
   * uses this to decide when it can stop talking to the signaling server.
   */
  onIceSettled?: () => void;
}

export class PeerLink {
  private pc: RTCPeerConnection | null = null;
  private pcReady: Promise<void> | null = null;
  private channel: RTCDataChannel | null = null;
  private readonly role: "sender" | "receiver";
  private readonly callbacks: PeerLinkCallbacks;
  private readonly iceServers: () => Promise<RTCIceServer[]>;
  private readonly tuning: () => LinkTuning;
  /** Serialises signal handling so messages apply in arrival order — see enqueueSignal. */
  private signalChain: Promise<void> = Promise.resolve();
  /** ICE candidates that arrived before there was a remote description to attach them to. */
  private pendingCandidates: RTCIceCandidateInit[] = [];
  /** Pending "did this recover?" check — see the disconnected branch in createPeerConnection. */
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Guards against counting one connection's path more than once. */
  private pathReported = false;
  /** The verification code is announced once per connection, not per state change. */
  private verificationSent = false;
  /** Timestamp of the last progress callback — see emitProgress. */
  private lastProgressAt = 0;
  private closed = false;

  constructor(
    role: "sender" | "receiver",
    iceServers: () => Promise<RTCIceServer[]>,
    callbacks: PeerLinkCallbacks,
    tuning: () => LinkTuning = () => DEFAULT_TUNING,
  ) {
    this.role = role;
    this.iceServers = iceServers;
    this.callbacks = callbacks;
    this.tuning = tuning;
  }

  get isOpen(): boolean {
    return this.channel?.readyState === "open";
  }

  /** Idempotent — safe to call from both a "peer joined" handler and a racing signal. */
  ensureConnection(): Promise<void> {
    if (!this.pcReady) this.pcReady = this.createPeerConnection();
    return this.pcReady;
  }

  private async createPeerConnection() {
    const iceServers = await this.iceServers();
    if (this.closed) return;
    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.callbacks.onSignal({ kind: "candidate", candidate: event.candidate.toJSON() });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;

      // Derived the moment the connection is actually up, which is the first
      // point both descriptions are settled and therefore the first point the
      // two sides would agree on an answer.
      if (state === "connected") void this.emitVerificationCode();

      // "failed" is terminal. "disconnected" is NOT, and treating it as one was
      // wrong: the spec describes it as transient, and ICE routinely recovers
      // from it after a short burst of packet loss. On a phone changing cells or
      // wifi wobbling it happens mid-transfer regularly — and never once on
      // loopback, which is why it looked fine in development. The old code
      // announced "Peer connection lost." over transfers that then completed
      // perfectly well.
      if (state === "failed") {
        if (!this.pathReported) {
          this.pathReported = true;
          countMetric("connection-failed");
        }
        this.callbacks.onError?.("Peer connection lost.");
        return;
      }

      if (state === "disconnected") {
        // Say nothing yet. Give ICE the chance to do its job first.
        if (this.disconnectTimer !== null) clearTimeout(this.disconnectTimer);
        this.disconnectTimer = setTimeout(() => {
          if (this.pc?.connectionState === "disconnected") {
            this.callbacks.onError?.("The connection dropped and could not recover. Try again.");
          }
        }, DISCONNECT_GRACE_MS);
        return;
      }

      if (state === "connected" && this.disconnectTimer !== null) {
        clearTimeout(this.disconnectTimer);
        this.disconnectTimer = null;
      }
    };

    // Which path the connection actually took. Relay bandwidth is the dominant
    // running cost of this service, so the direct-vs-relay ratio is the single
    // most valuable number to know about it — and nothing measured it until now.
    this.pc.addEventListener("iceconnectionstatechange", () => {
      const ice = this.pc?.iceConnectionState;
      if (ice === "connected" || ice === "completed") void this.reportConnectionPath();
    });

    const pc = this.pc;
    pc.addEventListener("icegatheringstatechange", () => {
      // Both sides done gathering means no further candidates exist to trade.
      if (pc.iceGatheringState === "complete" && pc.iceConnectionState === "completed") {
        this.callbacks.onIceSettled?.();
      }
    });

    if (this.role === "sender") {
      const channel = this.pc.createDataChannel("file-transfer", { ordered: true });
      this.setupChannel(channel);
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.callbacks.onSignal({ kind: "offer", sdp: this.pc.localDescription! });
    } else {
      this.pc.ondatachannel = (event) => this.setupChannel(event.channel);
    }
  }

  /**
   * Applies signals strictly one at a time, in arrival order.
   *
   * They used to run concurrently: `ws.onmessage` called an async handler
   * without awaiting it, so an offer and the candidates trailing it were all in
   * flight together. Two things went wrong with that, and the second cost real
   * money.
   *
   * Ordering was never guaranteed — two `setRemoteDescription` calls could
   * interleave. And a candidate arriving while the offer was still being applied
   * hit `addIceCandidate` with no remote description set, which throws
   * `InvalidStateError`. That was caught and discarded as "benign in rare
   * orderings". It is neither rare nor benign: the sender emits its host
   * candidates a millisecond or two after `setLocalDescription`, so they land
   * reliably inside the window where `setRemoteDescription` is still resolving,
   * and every one of them was thrown away permanently.
   *
   * A discarded candidate is a network path that never gets tried. Fewer paths
   * means more connections falling back to the TURN relay, and relay bandwidth
   * is the overwhelming majority of what this service costs to run — so silently
   * dropping candidates was both a reliability bug and the largest line on the
   * bill.
   */
  enqueueSignal(data: SignalData) {
    this.signalChain = this.signalChain.then(() => this.handleSignal(data)).catch(() => {});
  }

  private async handleSignal(data: SignalData) {
    await this.ensureConnection();
    const pc = this.pc;
    if (!pc) return;

    if (data.kind === "offer") {
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.callbacks.onSignal({ kind: "answer", sdp: pc.localDescription as RTCSessionDescriptionInit });
      await this.flushPendingCandidates();
    } else if (data.kind === "answer") {
      await pc.setRemoteDescription(data.sdp);
      await this.flushPendingCandidates();
    } else if (data.kind === "candidate") {
      // Held, not dropped, until there is a remote description to attach them
      // to. This is the whole fix — see enqueueSignal.
      if (!pc.remoteDescription) {
        this.pendingCandidates.push(data.candidate);
        return;
      }
      await this.addCandidate(data.candidate);
    }
  }

  /**
   * Reads back which path ICE actually selected, once, per connection.
   *
   * A "relay" candidate on either end means the bytes are going through TURN
   * and we are paying Cloudflare per gigabyte for them. Everything else is
   * direct and costs nothing. This is the only place that distinction is
   * visible, and it is the number the whole cost model rests on — see
   * src/lib/metrics.ts.
   */
  private async reportConnectionPath() {
    if (this.pathReported || !this.pc) return;
    this.pathReported = true;

    try {
      const stats = await this.pc.getStats();
      const pairs = new Map<string, RTCIceCandidatePairStats>();
      const candidates = new Map<string, { candidateType?: string }>();

      stats.forEach((report) => {
        if (report.type === "candidate-pair") pairs.set(report.id, report as RTCIceCandidatePairStats);
        if (report.type === "local-candidate" || report.type === "remote-candidate") {
          candidates.set(report.id, report as { candidateType?: string });
        }
      });

      const selected = [...pairs.values()].find((p) => p.state === "succeeded" && p.nominated) ??
        [...pairs.values()].find((p) => p.state === "succeeded");
      if (!selected) return;

      const localType = candidates.get(selected.localCandidateId ?? "")?.candidateType;
      const remoteType = candidates.get(selected.remoteCandidateId ?? "")?.candidateType;
      const relayed = localType === "relay" || remoteType === "relay";
      countMetric(relayed ? "connection-relay" : "connection-direct");
    } catch {
      // getStats is best-effort and shapes differ between browsers. A missing
      // measurement must never affect a transfer.
    }
  }

  private async flushPendingCandidates() {
    if (this.pendingCandidates.length === 0) return;
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) await this.addCandidate(candidate);
  }

  private async addCandidate(candidate: RTCIceCandidateInit) {
    try {
      await this.pc?.addIceCandidate(candidate);
    } catch {
      // With ordering now guaranteed, the only way to land here is a genuinely
      // malformed candidate from the peer. Skipping one bad candidate is right;
      // skipping every early one was not.
    }
  }

  private setupChannel(channel: RTCDataChannel) {
    this.channel = channel;
    channel.binaryType = "arraybuffer";
    channel.bufferedAmountLowThreshold = this.tuning().lowWatermark;

    channel.onopen = () => this.callbacks.onOpen?.();
    channel.onmessage = (event) => this.callbacks.onData?.(event.data);
    channel.onclose = () => this.callbacks.onClose?.();
  }

  /**
   * Works out the code both people can read to each other, and hands it up
   * once.
   *
   * Fires only when both fingerprints are actually readable. Showing a code
   * derived from partial information would be worse than showing none: the two
   * sides could disagree for an innocent reason, and a verification step that
   * cries wolf is one people learn to wave through — which is exactly the
   * habit an attacker needs.
   */
  private async emitVerificationCode() {
    if (this.verificationSent || !this.pc) return;
    const local = fingerprintFromSdp(this.pc.localDescription?.sdp);
    const remote = fingerprintFromSdp(this.pc.remoteDescription?.sdp);
    const code = await deriveVerificationCode(local, remote);
    if (!code || this.verificationSent) return;
    this.verificationSent = true;
    this.callbacks.onVerificationCode?.(code);
  }

  /**
   * Progress is throttled rather than emitted per chunk. Every call here is a
   * React state update on the other side of the callback; at one per 16KB chunk
   * a 29MB file queued ~1,850 re-renders that competed with the transfer itself
   * for the main thread. Always emits the final value so the bar lands on 100%.
   */
  private emitProgress(progress: FileProgress, force = false) {
    const now = Date.now();
    if (!force && now - this.lastProgressAt < PROGRESS_INTERVAL_MS) return;
    this.lastProgressAt = now;
    this.callbacks.onProgress?.(progress);
  }

  /** Sends a control frame, if the channel is still up. */
  sendControl(message: ControlMessage) {
    if (this.channel?.readyState !== "open") return;
    this.channel.send(JSON.stringify(message));
  }

  /** Stream one or more files over the open data channel, one at a time. */
  async sendFiles(files: File[]) {
    if (!this.channel || this.channel.readyState !== "open") {
      throw new Error("Data channel is not open yet.");
    }

    for (const file of files) {
      const id = crypto.randomUUID();
      this.channel.send(
        JSON.stringify({ type: "file-start", id, name: file.name, size: file.size, mime: file.type } satisfies ControlMessage),
      );

      const chunkSize = this.chunkSize();
      let offset = 0;
      while (offset < file.size) {
        // One read per slice, not one per chunk. The chunks below are views
        // into this buffer rather than copies of it, so carving it up costs
        // nothing.
        const sliceEnd = Math.min(offset + this.tuning().readSlice, file.size);
        const buffer = await file.slice(offset, sliceEnd).arrayBuffer();

        let position = 0;
        while (position < buffer.byteLength) {
          await this.waitForBufferedAmountLow();
          if (this.channel.readyState !== "open") return;

          // Never hand the channel more than it will hold, whatever the event
          // did or didn't fire. Polling here rather than trusting the event is
          // the difference between a pause and a thrown exception.
          while (this.channel.bufferedAmount > BUFFERED_AMOUNT_HARD_CEILING) {
            await new Promise((r) => setTimeout(r, 20));
            if (this.channel.readyState !== "open") return;
          }

          const length = Math.min(chunkSize, buffer.byteLength - position);
          try {
            this.channel.send(new Uint8Array(buffer, position, length));
          } catch (err) {
            this.callbacks.onError?.(
              err instanceof Error && err.message.includes("full")
                ? "The connection couldn't keep up and the transfer stopped. Try again."
                : "The connection dropped mid-transfer. Try again.",
            );
            return;
          }
          position += length;
          this.emitProgress({ id, name: file.name, size: file.size, sent: offset + position });
        }

        offset = sliceEnd;
      }
      this.emitProgress({ id, name: file.name, size: file.size, sent: file.size }, true);

      this.channel.send(JSON.stringify({ type: "file-end", id } satisfies ControlMessage));
    }

    this.channel.send(JSON.stringify({ type: "batch-end" } satisfies ControlMessage));
  }

  /**
   * The largest message this pair actually agreed to carry. SCTP negotiates it
   * and exposes it on pc.sctp.maxMessageSize; browsers that don't report it get
   * the conservative 16KB floor that used to be hardcoded for everyone. Capped
   * at 256KB because beyond that some stacks fragment anyway and a single
   * failed send costs more than the extra throughput wins.
   */
  private chunkSize(): number {
    const max = this.pc?.sctp?.maxMessageSize;
    if (typeof max !== "number" || !Number.isFinite(max) || max <= 0) return CHUNK_FLOOR;
    return Math.max(CHUNK_FLOOR, Math.min(CHUNK_CEILING, Math.floor(max)));
  }

  private waitForBufferedAmountLow(): Promise<void> {
    const channel = this.channel!;
    const { highWatermark, lowWatermark } = this.tuning();
    // Re-read each time: a link that opened when it was one of two now shares
    // the budget with however many are open at this moment.
    channel.bufferedAmountLowThreshold = lowWatermark;
    if (channel.bufferedAmount <= highWatermark) return Promise.resolve();
    return new Promise((resolve) => {
      const onLow = () => {
        channel.removeEventListener("bufferedamountlow", onLow);
        resolve();
      };
      channel.addEventListener("bufferedamountlow", onLow);
    });
  }

  close() {
    this.closed = true;
    if (this.disconnectTimer !== null) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    this.channel?.close();
    this.pc?.close();
    this.channel = null;
    this.pc = null;
    this.pcReady = null;
    // Candidates queued for a connection that no longer exists would otherwise
    // be flushed into the next one, where they mean nothing.
    this.pendingCandidates = [];
    this.signalChain = Promise.resolve();
  }
}
