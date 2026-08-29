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
  blob: Blob;
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
}

// 16KB keeps us well under the ~256KB per-message ceiling some browsers/OSes
// still enforce on RTCDataChannel, and is the widely-recommended safe chunk
// size for cross-browser compatibility.
const CHUNK_SIZE = 16 * 1024;

// Stop reading more chunks once the channel's send buffer backs up past
// this many bytes, and resume once it drains below it. Without this a fast
// sender can balloon browser memory / overwhelm a TURN relay.
const BUFFERED_AMOUNT_HIGH_WATERMARK = 4 * 1024 * 1024; // 4MB
const BUFFERED_AMOUNT_LOW_WATERMARK = 1 * 1024 * 1024; // 1MB

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

  // Receiver-side reassembly state, keyed by file id.
  private incoming = new Map<
    string,
    { name: string; size: number; mime: string; received: number; chunks: ArrayBuffer[] }
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
      if (this.closedByUser) return;
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
          this.callbacks.onStatus?.("error", "The other side disconnected.");
          break;
        case "room-expired":
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
      // Signaling server's job is done — everything from here is direct P2P.
      this.ws?.close();
    };

    channel.onmessage = (event) => this.handleChannelMessage(event.data);
    channel.onclose = () => this.callbacks.onStatus?.("done");
  }

  private handleChannelMessage(data: string | ArrayBuffer) {
    if (typeof data === "string") {
      const msg: ControlMessage = JSON.parse(data);
      if (msg.type === "file-start") {
        this.incoming.set(msg.id, { name: msg.name, size: msg.size, mime: msg.mime, received: 0, chunks: [] });
        this.callbacks.onStatus?.("transferring");
      } else if (msg.type === "file-end") {
        const entry = this.incoming.get(msg.id);
        if (!entry) return;
        const blob = new Blob(entry.chunks, { type: entry.mime });
        this.callbacks.onFileReceived?.({ id: msg.id, name: entry.name, size: entry.size, blob });
        this.incoming.delete(msg.id);
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
    entry.chunks.push(data);
    entry.received += data.byteLength;
    this.callbacks.onProgress?.({ id, name: entry.name, size: entry.size, sent: entry.received });
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

      let offset = 0;
      while (offset < file.size) {
        await this.waitForBufferedAmountLow();
        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const buffer = await slice.arrayBuffer();
        this.channel.send(buffer);
        offset += buffer.byteLength;
        this.callbacks.onProgress?.({ id, name: file.name, size: file.size, sent: offset });
      }

      this.channel.send(JSON.stringify({ type: "file-end", id } satisfies ControlMessage));
    }

    this.channel.send(JSON.stringify({ type: "batch-end" } satisfies ControlMessage));
    this.callbacks.onStatus?.("done");
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

  close() {
    this.closedByUser = true; // suppress any in-flight retry from firing after a deliberate close
    this.channel?.close();
    this.pc?.close();
    this.ws?.close();
  }
}
