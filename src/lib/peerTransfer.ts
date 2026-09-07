// Core P2P file-transfer engine.
//
// Flow: both sides open a WebSocket to the signaling server (see /server) to
// exchange a short room code and then WebRTC offer/answer/ICE messages. Once
// the RTCPeerConnection's data channel opens, the signaling server is no
// longer involved — file bytes stream directly between browsers (or through
// a TURN relay if a direct path can't be established), never touching our
// servers.
//
// This file intentionally has no React/UI code in it, so the transfer logic
// can be unit-tested and reused independent of how it's rendered.

export type TransferStatus =
  | "idle"
  | "connecting-signal"
  | "waiting-for-peer"
  | "negotiating"
  | "connected"
  | "transferring"
  | "done"
  | "error";

export interface IncomingFile {
  id: string;
  name: string;
  size: number;
  /**
   * Present only when the file was buffered. When the receiver chose a folder
   * up front, the bytes went straight to disk and were never held anywhere we
   * could hand back — that case sets savedTo instead.
   */
  blob?: Blob;
  /** Name of the folder the file was written into, when streaming to disk. */
  savedTo?: string;
}

export interface FileProgress {
  id: string;
  name: string;
  size: number;
  sent: number;
}

export interface PeerTransferCallbacks {
  onStatus?: (status: TransferStatus, detail?: string) => void;
  /**
   * Fires once the signaling server has issued a code, with when it stops
   * working. `secret` is present only for long-lived rooms, which cannot be
   * joined by code alone — see generateRoomSecret in /server/index.js.
   */
  onCode?: (code: string, expiresAt: number, secret: string | null) => void;
  /** Fired repeatedly while a file is being sent or received. */
  onProgress?: (progress: FileProgress) => void;
  /** Fired once per file, once fully received (receiver side only). */
  onFileReceived?: (file: IncomingFile) => void;
  onError?: (message: string) => void;
  /**
   * Something worth telling the user that is not a failure — currently the
   * storage-headroom warning. It needs its own channel: routing it through
   * onStatus meant the message rode along as a detail on a non-error status,
   * and the UI only reads detail when the status IS an error, so it was
   * silently dropped every time.
   */
  onNotice?: (message: string) => void;
}

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
const READ_SLICE_SIZE = 4 * 1024 * 1024;

// Stop reading more chunks once the channel's send buffer backs up past
// this many bytes, and resume once it drains below it. Without this a fast
// sender can balloon browser memory / overwhelm a TURN relay.
const BUFFERED_AMOUNT_HIGH_WATERMARK = 8 * 1024 * 1024; // 8MB
const BUFFERED_AMOUNT_LOW_WATERMARK = 2 * 1024 * 1024; // 2MB

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

// How long the signaling socket is kept open after the data channel opens, so
// ICE can finish trickling and upgrade off the relay if a direct path exists.
const SIGNALING_GRACE_MS = 15 * 1000;

// How often to speak on an otherwise idle signaling socket.
//
// The signaling server pings us on its own cadence and the browser answers
// those automatically, which is what actually keeps Cloudflare's ~100s idle
// timeout from closing the connection (see HEARTBEAT_INTERVAL_MS in
// /server/index.js for the incident this comes from). This is the second half
// of that, sent from here for one reason: page JavaScript cannot observe a
// ping frame, so if the server's heartbeat were ever misconfigured this side
// would have no way to notice and no way to compensate. A few bytes every
// half-minute buys independence from that.
//
// It is only ever running while a socket is open and a transfer is waiting,
// which is exactly the window the sender is told to leave the tab open for.
const KEEPALIVE_INTERVAL_MS = 30 * 1000;

// How long a "disconnected" peer connection is given to recover before the user
// is told anything. The state is transient by specification — ICE re-checks
// paths and frequently recovers — so announcing it immediately turned an
// ordinary wifi wobble into a failure message over a transfer that was still
// running. Ten seconds is well past a normal recovery and well short of a user
// concluding the page has hung.
const DISCONNECT_GRACE_MS = 10 * 1000;

// Received chunks are sealed into a Blob segment every time this much has piled
// up. Previously every chunk of a file was held as an ArrayBuffer until the
// file completed, so peak JS heap was the entire file — and then Blob
// construction briefly doubled it. That is the real ceiling behind "any size":
// a 4GB file needed ~8GB of heap on the receiving device, which no phone has
// and few laptops will give a single tab.
//
// A Blob is a handle to storage the browser manages and can page to disk, and
// combining Blobs doesn't copy their bytes. So sealing as we go keeps live heap
// at this constant regardless of file size.
const COALESCE_BYTES = 8 * 1024 * 1024;

import { sanitizeFilename } from "./sanitize";
import { countMetric, countTransfer } from "./metrics";
import { formatBytes } from "./format";

/**
 * Finds a name not already taken in the folder. Overwriting a file the user
 * already had, because a stranger happened to send something with the same
 * name, would be the worst kind of surprise — so "report.pdf" becomes
 * "report (2).pdf" instead.
 */
async function uniqueNameIn(dir: SffDirectoryHandle, name: string): Promise<string> {
  const dot = name.lastIndexOf(".");
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";

  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? name : `${stem} (${n})${ext}`;
    try {
      await dir.getFileHandle(candidate);
      // It resolved, so the name is taken — try the next one.
    } catch {
      // NotFoundError is the good case: nothing is using this name.
      return candidate;
    }
  }
  return `${stem} (${Date.now()})${ext}`;
}

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

async function fetchIceServers(): Promise<RTCIceServer[]> {
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
}

function signalingUrl(): string {
  return process.env.NEXT_PUBLIC_SIGNALING_URL || "ws://localhost:8080";
}

type ControlMessage =
  | { type: "file-start"; id: string; name: string; size: number; mime: string }
  | { type: "file-end"; id: string }
  | { type: "batch-end" };

/**
 * The type every received file is given, regardless of what the sender called
 * it — and the reason it is a constant rather than a variable.
 *
 * A received file becomes a Blob, and that Blob gets an object URL, and that
 * URL is `blob:https://sharefilesfree.com/<uuid>` — an address on THIS
 * origin. If the Blob carries a renderable type, anything that navigates to
 * that URL renders sender-controlled content as this site: `text/html` runs
 * script, and so does `image/svg+xml`, which is the one people forget. From
 * there it can read this origin's storage, register a service worker for
 * persistence, and put a convincing phishing page on the real domain with the
 * real certificate.
 *
 * The download link sets `download`, which makes a normal click save rather
 * than navigate — but that is one attribute standing between a stranger's
 * HTML and this origin, and it is not a boundary worth resting on. "Copy link
 * address" and paste is enough to defeat it, and so is any future change that
 * previews a received file inline.
 *
 * So the sender's declared type is never applied. It buys nothing: the saved
 * filename comes from the `download` attribute and the extension in it, not
 * from the Blob's type, so a file saved as octet-stream still opens in the
 * right application afterwards. The wire format still carries `mime` because
 * older peers send it and a deploy leaves both versions live for a while; the
 * receiver simply ignores it.
 */
const RECEIVED_BLOB_TYPE = "application/octet-stream";

type SignalData =
  | { kind: "offer"; sdp: RTCSessionDescriptionInit }
  | { kind: "answer"; sdp: RTCSessionDescriptionInit }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

// A transient blip while opening the signaling connection (flaky wifi, a
// server restart) shouldn't force the user to manually retry — quietly retry
// a few times with backoff before surfacing an error. Once a socket has
// successfully opened at least once, a later close is treated as a real
// disconnect instead (the server-side room state doesn't survive a
// reconnect anyway, so there's nothing useful to retry into at that point).
const MAX_CONNECT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;

export class PeerTransfer {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private pcReady: Promise<void> | null = null;
  private channel: RTCDataChannel | null = null;
  private readonly role: "sender" | "receiver";
  private readonly callbacks: PeerTransferCallbacks;
  private roomCode: string | null = null;
  private connectAttempt = 0;
  private closedByUser = false;
  /** Timestamp of the last progress callback — see emitProgress. */
  private lastProgressAt = 0;
  private signalingCloseTimer: ReturnType<typeof setTimeout> | null = null;
  /** Keeps an idle signaling socket from being closed by a proxy — see KEEPALIVE_INTERVAL_MS. */
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  /** Serialises signal handling so messages apply in arrival order — see enqueueSignal. */
  private signalChain: Promise<void> = Promise.resolve();
  /** ICE candidates that arrived before there was a remote description to attach them to. */
  private pendingCandidates: RTCIceCandidateInit[] = [];
  /** Pending "did this recover?" check — see the disconnected branch in createPeerConnection. */
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  /** Guards against counting one connection's path more than once. */
  private pathReported = false;
  /** Running totals for the batch currently arriving — reported once at batch-end. */
  private batchFiles = 0;
  private batchBytes = 0;
  private batchLargest = 0;
  /** Chosen by the receiver before connecting — see setSaveDirectory. */
  private saveDir: SffDirectoryHandle | null = null;
  /** Assembles files on disk off the main thread — see fileSink.worker.ts. */
  private sink: Worker | null = null;
  /** id -> the file-start details we need when the worker hands the file back. */
  private sunkFiles = new Map<string, { name: string; size: number }>();
  /**
   * The file currently receiving chunks. Looked up per chunk, and it used to be
   * found by spreading the whole incoming Map into an array and popping it —
   * an allocation for every chunk of every file, on the hot path.
   */
  private activeIncomingId: string | null = null;
  /**
   * Set whenever WE close the signaling socket, so onclose can tell a deliberate
   * shutdown from a dropped connection. It used to infer that from "is the data
   * channel still open?", which was only ever true because the socket was closed
   * the instant the channel opened. Once the close moved later — to let ICE
   * finish trickling — a finished transfer looked exactly like a dropped one,
   * and the sender was told the connection died right after it succeeded.
   */
  private signalingClosedByUs = false;

  // Receiver-side reassembly state, keyed by file id.
  private incoming = new Map<
    string,
    {
      name: string;
      size: number;
      mime: string;
      received: number;
      /** Sealed Blob segments. A Blob is a handle the browser can page to disk, not bytes on the JS heap. */
      parts: Blob[];
      /** Chunks not yet sealed into a segment — never more than COALESCE_BYTES of them. */
      pending: ArrayBuffer[];
      pendingBytes: number;
      /** Set when this file is being written straight to the folder the user picked. */
      streaming: boolean;
      /** Set when the OPFS worker is assembling this file on disk instead. */
      sunk: boolean;
      writable: SffWritableFileStream | null;
      /**
       * Serialises every disk operation for this file. Opening the handle is
       * async but chunks start arriving immediately, so each write is appended
       * to this chain — that guarantees they land in the order they arrived,
       * which for a file is the whole ballgame.
       */
      chain: Promise<void>;
      /** The name actually used on disk, which may be suffixed to avoid a collision. */
      savedName: string;
    }
  >();

  constructor(role: "sender" | "receiver", callbacks: PeerTransferCallbacks) {
    this.role = role;
    this.callbacks = callbacks;
  }

  /**
   * Sender: open a socket and request a fresh room code.
   *
   * `ttlMinutes` is how long the code should keep working while this tab stays
   * open. The server snaps it to an allowed value and picks the code length to
   * match — a longer-lived code is a longer code, because it is guessable for
   * longer. See generateRoomCode in /server.
   */
  connectAsSender(ttlMinutes = 10) {
    this.callbacks.onStatus?.("connecting-signal");
    this.openSocket(() => this.send({ type: "create-room", ttlMinutes }));
  }

  /**
   * Receiver: open a socket and try to join an existing room.
   *
   * `secret` comes from the link or QR the sender shared. A long-lived room
   * refuses a join without it, and refuses it identically to a wrong code so a
   * guesser learns nothing from the difference.
   */
  connectAsReceiver(code: string, secret?: string | null) {
    this.callbacks.onStatus?.("connecting-signal");
    this.openSocket(() => this.send({ type: "join-room", code, secret: secret ?? undefined }));
  }

  private openSocket(onOpen: () => void) {
    const ws = new WebSocket(signalingUrl());
    this.ws = ws;
    let opened = false;

    ws.onopen = () => {
      opened = true;
      this.connectAttempt = 0;
      this.startKeepalive();
      onOpen();
    };

    ws.onclose = () => {
      this.stopKeepalive();
      if (this.closedByUser || this.signalingClosedByUs) return;
      if (opened) {
        if (this.channel?.readyState !== "open") {
          // Reported as a status change, not just an error line, because the
          // room died with the socket: the server drops it on close, so the
          // code on screen is already meaningless. Leaving the UI on the
          // waiting screen kept showing that dead code next to the error,
          // inviting the sender to read out digits nobody can redeem.
          this.callbacks.onStatus?.(
            "error",
            "The connection to the server dropped before anyone collected the file. Start again to get a new code.",
          );
        }
        return;
      }
      if (this.connectAttempt < MAX_CONNECT_RETRIES) {
        this.connectAttempt += 1;
        const delay = RETRY_BASE_DELAY_MS * 2 ** (this.connectAttempt - 1);
        setTimeout(() => this.openSocket(onOpen), delay);
      } else {
        this.callbacks.onError?.("Could not reach the signaling server. Check your connection and try again.");
      }
    };

    ws.onmessage = (event) => {
      // Anything arriving here came off the network. An unparseable frame is
      // not a reason to throw out of an event handler with no catch above it —
      // that surfaces as an unhandled rejection and leaves the transfer wedged
      // in whatever state it was in. Ignore the frame instead.
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;
      switch (msg.type) {
        case "room-created":
          this.roomCode = msg.code;
          this.callbacks.onCode?.(msg.code, msg.expiresAt, msg.secret ?? null);
          this.callbacks.onStatus?.("waiting-for-peer");
          break;
        case "peer-joined":
          this.callbacks.onStatus?.("negotiating");
          this.ensurePeerConnection();
          break;
        case "signal":
          this.enqueueSignal(msg.data);
          break;
        case "peer-left":
          // The peer connection was left open here. It could never connect
          // again — the other side is gone — so it sat gathering nothing and
          // eventually reported "failed", which is the abandoned connection
          // that shows up in webrtc-internals with no candidates at all.
          this.teardownPeer();
          this.callbacks.onStatus?.("error", "The other side disconnected.");
          break;
        case "room-expired":
          this.teardownPeer();
          this.callbacks.onError?.("Nobody joined in time. Generate a new code.");
          break;
        case "error":
          this.callbacks.onError?.(msg.message);
          break;
      }
    };
  }

  private startKeepalive() {
    this.stopKeepalive();
    this.keepaliveTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) this.send({ type: "keepalive" });
    }, KEEPALIVE_INTERVAL_MS);
  }

  private stopKeepalive() {
    if (this.keepaliveTimer !== null) {
      clearInterval(this.keepaliveTimer);
      this.keepaliveTimer = null;
    }
  }

  private send(message: unknown) {
    this.ws?.send(JSON.stringify(message));
  }

  private sendSignal(data: unknown) {
    this.send({ type: "signal", data });
  }

  /** Idempotent — safe to call from both the "peer-joined" handler and a racing "signal" message. */
  private ensurePeerConnection(): Promise<void> {
    if (!this.pcReady) this.pcReady = this.createPeerConnection();
    return this.pcReady;
  }

  private async createPeerConnection() {
    const iceServers = await fetchIceServers();
    this.pc = new RTCPeerConnection({ iceServers });

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({ kind: "candidate", candidate: event.candidate.toJSON() });
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState;

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

    if (this.role === "sender") {
      const channel = this.pc.createDataChannel("file-transfer", { ordered: true });
      this.setupChannel(channel);
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.sendSignal({ kind: "offer", sdp: this.pc.localDescription! });
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
  private enqueueSignal(data: SignalData) {
    this.signalChain = this.signalChain.then(() => this.handleSignal(data)).catch(() => {});
  }

  private async handleSignal(data: SignalData) {
    await this.ensurePeerConnection();
    const pc = this.pc;
    if (!pc) return;

    if (data.kind === "offer") {
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal({ kind: "answer", sdp: pc.localDescription });
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
    channel.bufferedAmountLowThreshold = BUFFERED_AMOUNT_LOW_WATERMARK;

    channel.onopen = () => {
      this.callbacks.onStatus?.("connected");
      // Signaling is NOT closed here, though it used to be.
      //
      // ICE keeps trickling candidates after the channel opens, and the first
      // pair to succeed is very often the TURN relay — relay allocation
      // typically beats hole-punching. Closing the socket at this moment threw
      // away every candidate still in flight, so a connection that could have
      // upgraded to a direct path stayed on the relay for the whole transfer,
      // paying relay latency and Cloudflare bandwidth for files that never
      // needed either.
      //
      // So the socket stays open until ICE has actually settled, and is closed
      // by a hard deadline regardless so it never lingers.
      this.scheduleSignalingClose();
    };

    channel.onmessage = (event) => this.handleChannelMessage(event.data);
    channel.onclose = () => this.callbacks.onStatus?.("done");
  }

  private handleChannelMessage(data: string | ArrayBuffer) {
    if (typeof data === "string") {
      // The peer on the other end of this channel is a stranger, and a control
      // frame that doesn't parse is the cheapest thing they can send. Throwing
      // here would escape into the data channel's message handler, where
      // nothing catches it.
      let msg: ControlMessage;
      try {
        msg = JSON.parse(data) as ControlMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object" || typeof msg.type !== "string") return;
      if (msg.type === "file-start") {
        // Everything in this message came from the peer, so none of it is
        // trusted. The name is sanitized before it ever reaches a download
        // attribute, and the size is clamped — it is used below as a hard
        // ceiling on how much we will buffer for this file.
        this.incoming.set(msg.id, {
          name: sanitizeFilename(String(msg.name ?? "file")),
          size: Math.max(0, Number(msg.size) || 0),
          // Not the sender's — see RECEIVED_BLOB_TYPE.
          mime: RECEIVED_BLOB_TYPE,
          received: 0,
          parts: [],
          pending: [],
          pendingBytes: 0,
          streaming: false,
          sunk: false,
          writable: null,
          chain: Promise.resolve(),
          savedName: "",
        });

        const entry = this.incoming.get(msg.id)!;
        this.activeIncomingId = msg.id;
        if (this.saveDir) {
          // Straight to disk. Nothing accumulates anywhere, so the file's size
          // stops being a question about this device's memory at all.
          entry.streaming = true;
          const dir = this.saveDir;
          entry.chain = (async () => {
            const name = await uniqueNameIn(dir, entry.name);
            entry.savedName = name;
            const handle = await dir.getFileHandle(name, { create: true });
            entry.writable = await handle.createWritable();
          })();
        } else if (this.ensureSink()) {
          // No folder chosen, but the file is still assembled on disk by the
          // worker instead of in this page's memory. This is the path phones
          // take, and it is why size is no longer bounded by RAM there.
          entry.sunk = true;
          this.sunkFiles.set(msg.id, { name: entry.name, size: entry.size });
          // The size travels with the open so the worker can verify, at close, that
          // what landed on disk is what was promised.
          this.sink!.postMessage({ type: "open", id: msg.id, name: entry.name, size: entry.size });
          // Bounded by the origin's storage quota rather than by RAM, which is a
          // far higher ceiling but still a ceiling — and on a phone with little
          // free space it can be the lower one. This warning used to fire only
          // on the memory path, so the case most likely to hit a limit was the
          // one case that said nothing until it failed.
          void this.warnIfOverStorageQuota(Math.max(0, Number(msg.size) || 0));
        } else {
          // Nothing but memory available. Warn before the transfer rather than
          // after it fails at 90%.
          void this.warnIfOverStorageQuota(Math.max(0, Number(msg.size) || 0));
        }
        this.callbacks.onStatus?.("transferring");
      } else if (msg.type === "file-end") {
        const entry = this.incoming.get(msg.id);
        if (!entry) return;
        this.incoming.delete(msg.id);

        // Counted from bytes actually received, not from the size the sender
        // declared — a truncated transfer should not inflate the public total.
        this.batchFiles += 1;
        this.batchBytes += entry.received;
        if (entry.received > this.batchLargest) this.batchLargest = entry.received;

        if (entry.sunk) {
          // onFileReceived fires when the worker reports the file closed, not
          // here — the last writes may still be in flight.
          this.sink?.postMessage({ type: "close", id: msg.id, mime: entry.mime });
          return;
        }

        if (entry.streaming) {
          const folder = this.saveDir?.name ?? "the chosen folder";
          entry.chain
            .then(() => entry.writable?.close())
            .then(() => {
              this.callbacks.onFileReceived?.({ id: msg.id, name: entry.savedName || entry.name, size: entry.size, savedTo: folder });
            })
            .catch(() => {
              this.callbacks.onError?.(`Could not finish writing ${entry.name} to ${folder}. The folder may have been moved, or permission withdrawn.`);
            });
          return;
        }

        const blob = new Blob([...entry.parts, ...entry.pending], { type: entry.mime });
        this.callbacks.onFileReceived?.({ id: msg.id, name: entry.name, size: entry.size, blob });
      } else if (msg.type === "batch-end") {
        // Reported once for the whole batch rather than per file, so the public
        // "transfers" figure counts what a person would call a transfer.
        countTransfer(this.batchFiles, this.batchBytes, this.batchLargest);
        this.batchFiles = 0;
        this.batchBytes = 0;
        this.batchLargest = 0;
        this.callbacks.onStatus?.("done");
      }
      return;
    }

    // Binary chunk: it belongs to the file currently in flight, since transfers
    // are sequential. That used to be found by spreading the whole Map into an
    // array and popping it — an allocation on every chunk of every file, on the
    // hottest path in the program. The id is simply remembered instead.
    const id = this.activeIncomingId;
    const entry = id ? this.incoming.get(id) : undefined;
    if (!id || !entry) return;

    // A peer that keeps sending past the size it declared is not a peer with a
    // bug, it is a peer trying to exhaust this tab's memory — we buffer every
    // chunk until the file completes, so without this the sender chooses how
    // much RAM the receiver spends. Stop the transfer instead.
    if (entry.received + data.byteLength > entry.size) {
      this.callbacks.onError?.("The sender sent more data than it declared. Transfer stopped.");
      this.close();
      return;
    }

    entry.received += data.byteLength;

    if (entry.sunk) {
      // Transferred, not copied: the page gives the buffer away and the worker
      // writes it, so bytes never accumulate here and the assembly work is off
      // the thread that has to keep draining the data channel.
      this.sink?.postMessage({ type: "write", id, buffer: data }, [data]);
      this.emitProgress({ id, name: entry.name, size: entry.size, sent: entry.received }, entry.received === entry.size);
      return;
    }

    if (entry.streaming) {
      // Appending to the chain rather than awaiting keeps this handler
      // synchronous — the data channel's onmessage must not block — while
      // still writing strictly in arrival order.
      const bytes = new Uint8Array(data);
      entry.chain = entry.chain.then(() => entry.writable?.write(bytes)).then(() => undefined);
      this.emitProgress({ id, name: entry.name, size: entry.size, sent: entry.received }, entry.received === entry.size);
      return;
    }

    entry.pending.push(data);
    entry.pendingBytes += data.byteLength;

    // Seal what has piled up into a Blob segment and drop the buffers. This is
    // the whole memory story: live heap stays at COALESCE_BYTES no matter how
    // big the file is.
    if (entry.pendingBytes >= COALESCE_BYTES) {
      entry.parts.push(new Blob(entry.pending));
      entry.pending = [];
      entry.pendingBytes = 0;
    }

    this.emitProgress({ id, name: entry.name, size: entry.size, sent: entry.received }, entry.received === entry.size);
  }

  /**
   * The OPFS sink, started on first use. Returns null where the platform can't
   * support it, and the caller falls back to assembling in memory.
   */
  private ensureSink(): Worker | null {
    if (this.sink) return this.sink;
    if (typeof Worker === "undefined" || !navigator.storage?.getDirectory) return null;
    try {
      this.sink = new Worker(new URL("./fileSink.worker.ts", import.meta.url));
      this.sink.onmessage = (event: MessageEvent) => {
        const msg = event.data as { type: string; id: string; file?: File; message?: string };
        if (msg.type === "done" && msg.file) {
          const meta = this.sunkFiles.get(msg.id);
          this.sunkFiles.delete(msg.id);
          if (!meta) return;
          // A File from OPFS references bytes on disk rather than holding them,
          // so handing it on as the blob costs no memory at any size.
          this.callbacks.onFileReceived?.({ id: msg.id, name: meta.name, size: meta.size, blob: msg.file });
        } else if (msg.type === "failed") {
          this.sunkFiles.delete(msg.id);
          this.callbacks.onError?.(msg.message || "Could not write the file to storage.");
        }
      };
      return this.sink;
    } catch {
      this.sink = null;
      return null;
    }
  }

  /**
   * Hands the transfer a folder to write incoming files into, chosen by the
   * receiver before connecting. It has to be before: the picker needs a user
   * gesture, and files arrive long after the last click.
   */
  setSaveDirectory(handle: SffDirectoryHandle | null) {
    this.saveDir = handle;
  }

  /**
   * Checks the declared size against what this origin is actually allowed to
   * store on this device, and warns up front if it won't fit. Advisory only —
   * the estimate is deliberately imprecise and some browsers grant more when
   * asked — so it never refuses a transfer, it just stops the failure from
   * being a surprise three gigabytes in.
   */
  private async warnIfOverStorageQuota(declaredSize: number) {
    try {
      if (declaredSize <= 0 || !navigator.storage?.estimate) return;
      const { quota, usage } = await navigator.storage.estimate();
      if (typeof quota !== "number") return;
      const headroom = quota - (usage ?? 0);
      if (declaredSize > headroom) {
        this.callbacks.onNotice?.(
          `This file is bigger than the space this browser will give the page (about ${formatBytes(headroom)}), so it may not finish. Receiving it on a laptop, or picking a folder to save into, avoids the limit.`,
        );
      }
    } catch {
      // Storage estimation is best-effort; never let it break a transfer.
    }
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

  /** Sender: stream one or more files over the open data channel, one at a time. */
  async sendFiles(files: File[]) {
    if (!this.channel || this.channel.readyState !== "open") {
      throw new Error("Data channel is not open yet.");
    }
    this.callbacks.onStatus?.("transferring");

    for (const file of files) {
      const id = crypto.randomUUID();
      this.channel.send(
        JSON.stringify({ type: "file-start", id, name: file.name, size: file.size, mime: file.type } satisfies ControlMessage),
      );

      const chunkSize = this.chunkSize();
      let offset = 0;
      while (offset < file.size) {
        // One read per 4MB, not one per chunk. The chunks below are views into
        // this buffer rather than copies of it, so carving it up costs nothing.
        const sliceEnd = Math.min(offset + READ_SLICE_SIZE, file.size);
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
    this.callbacks.onStatus?.("done");
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
    if (channel.bufferedAmount <= BUFFERED_AMOUNT_HIGH_WATERMARK) return Promise.resolve();
    return new Promise((resolve) => {
      const onLow = () => {
        channel.removeEventListener("bufferedamountlow", onLow);
        resolve();
      };
      channel.addEventListener("bufferedamountlow", onLow);
    });
  }

  /**
   * Closes the signaling socket once ICE has settled rather than the moment the
   * data channel opens, so late candidates can still arrive and let the
   * connection upgrade off the relay. The deadline is a backstop: if ICE never
   * reaches a terminal state we still stop talking to the server.
   */
  private scheduleSignalingClose() {
    if (this.signalingCloseTimer !== null) return;

    const closeNow = () => {
      if (this.signalingCloseTimer !== null) {
        clearTimeout(this.signalingCloseTimer);
        this.signalingCloseTimer = null;
      }
      this.signalingClosedByUs = true;
      this.ws?.close();
    };

    const pc = this.pc;
    if (pc) {
      pc.addEventListener("icegatheringstatechange", () => {
        // Both sides done gathering means no further candidates exist to trade.
        if (pc.iceGatheringState === "complete" && pc.iceConnectionState === "completed") closeNow();
      });
    }

    this.signalingCloseTimer = setTimeout(closeNow, SIGNALING_GRACE_MS);
  }

  /** Tears down the peer connection without marking the whole transfer closed by the user. */
  private teardownPeer() {
    this.channel?.close();
    this.pc?.close();
    this.channel = null;
    this.pc = null;
    this.pcReady = null;
    // Candidates queued for a connection that no longer exists would otherwise
    // be flushed into the next one, where they mean nothing.
    this.pendingCandidates = [];
    this.signalChain = Promise.resolve();
    if (this.disconnectTimer !== null) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  close() {
    if (this.signalingCloseTimer !== null) {
      clearTimeout(this.signalingCloseTimer);
      this.signalingCloseTimer = null;
    }
    this.stopKeepalive();
    if (this.disconnectTimer !== null) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
    this.signalingClosedByUs = true;
    this.closedByUser = true;
    this.sink?.terminate();
    this.sink = null; // suppress any in-flight retry from firing after a deliberate close
    this.channel?.close();
    this.pc?.close();
    this.ws?.close();
  }
}
