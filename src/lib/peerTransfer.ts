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
  onCode?: (code: string) => void;
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

// Progress used to fire once per chunk — ~1,850 React state updates for a
// 29MB file, each one a re-render competing with the transfer for the main
// thread. The UI cannot show more than a few updates a second anyway.
const PROGRESS_INTERVAL_MS = 60;

// How long the signaling socket is kept open after the data channel opens, so
// ICE can finish trickling and upgrade off the relay if a direct path exists.
const SIGNALING_GRACE_MS = 15 * 1000;

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

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch("/api/turn-credentials");
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
  /** Chosen by the receiver before connecting — see setSaveDirectory. */
  private saveDir: SffDirectoryHandle | null = null;
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

  /** Sender: open a socket and request a fresh room code. */
  connectAsSender() {
    this.callbacks.onStatus?.("connecting-signal");
    this.openSocket(() => this.send({ type: "create-room" }));
  }

  /** Receiver: open a socket and try to join an existing room by code. */
  connectAsReceiver(code: string) {
    this.callbacks.onStatus?.("connecting-signal");
    this.openSocket(() => this.send({ type: "join-room", code }));
  }

  private openSocket(onOpen: () => void) {
    const ws = new WebSocket(signalingUrl());
    this.ws = ws;
    let opened = false;

    ws.onopen = () => {
      opened = true;
      this.connectAttempt = 0;
      onOpen();
    };

    ws.onclose = () => {
      if (this.closedByUser || this.signalingClosedByUs) return;
      if (opened) {
        if (this.channel?.readyState !== "open") {
          this.callbacks.onError?.("Signaling connection closed unexpectedly.");
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
      const msg = JSON.parse(event.data);
      switch (msg.type) {
        case "room-created":
          this.roomCode = msg.code;
          this.callbacks.onCode?.(msg.code);
          this.callbacks.onStatus?.("waiting-for-peer");
          break;
        case "peer-joined":
          this.callbacks.onStatus?.("negotiating");
          this.ensurePeerConnection();
          break;
        case "signal":
          this.handleSignal(msg.data);
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
      if (this.pc?.connectionState === "failed" || this.pc?.connectionState === "disconnected") {
        this.callbacks.onError?.("Peer connection lost.");
      }
    };

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

  private async handleSignal(data: SignalData) {
    await this.ensurePeerConnection();
    const pc = this.pc!;
    if (data.kind === "offer") {
      await pc.setRemoteDescription(data.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      this.sendSignal({ kind: "answer", sdp: pc.localDescription });
    } else if (data.kind === "answer") {
      await pc.setRemoteDescription(data.sdp);
    } else if (data.kind === "candidate") {
      try {
        await pc.addIceCandidate(data.candidate);
      } catch {
        // Benign if it arrives before the remote description is set in rare orderings.
      }
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
      const msg: ControlMessage = JSON.parse(data);
      if (msg.type === "file-start") {
        // Everything in this message came from the peer, so none of it is
        // trusted. The name is sanitized before it ever reaches a download
        // attribute, and the size is clamped — it is used below as a hard
        // ceiling on how much we will buffer for this file.
        this.incoming.set(msg.id, {
          name: sanitizeFilename(String(msg.name ?? "file")),
          size: Math.max(0, Number(msg.size) || 0),
          mime: typeof msg.mime === "string" ? msg.mime.slice(0, 255) : "application/octet-stream",
          received: 0,
          parts: [],
          pending: [],
          pendingBytes: 0,
          streaming: false,
          writable: null,
          chain: Promise.resolve(),
          savedName: "",
        });

        const entry = this.incoming.get(msg.id)!;
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
        } else {
          // Buffered path: warn before the transfer rather than after it fails
          // at 90%. The quota is what this origin may store on this device —
          // the honest ceiling, and far smaller on a phone than on a laptop.
          void this.warnIfOverStorageQuota(Math.max(0, Number(msg.size) || 0));
        }
        this.callbacks.onStatus?.("transferring");
      } else if (msg.type === "file-end") {
        const entry = this.incoming.get(msg.id);
        if (!entry) return;
        this.incoming.delete(msg.id);

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
        this.callbacks.onStatus?.("done");
      }
      return;
    }

    // Binary chunk: attribute it to whichever file is currently in flight.
    // Since transfers are sequential (one file at a time), this is simply
    // the most recently started, not-yet-finished entry.
    const active = [...this.incoming.entries()].pop();
    if (!active) return;
    const [id, entry] = active;

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
          const length = Math.min(chunkSize, buffer.byteLength - position);
          this.channel.send(new Uint8Array(buffer, position, length));
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
  }

  close() {
    if (this.signalingCloseTimer !== null) {
      clearTimeout(this.signalingCloseTimer);
      this.signalingCloseTimer = null;
    }
    this.signalingClosedByUs = true;
    this.closedByUser = true; // suppress any in-flight retry from firing after a deliberate close
    this.channel?.close();
    this.pc?.close();
    this.ws?.close();
  }
}
