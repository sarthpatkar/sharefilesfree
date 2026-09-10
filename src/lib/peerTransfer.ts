// One-to-one P2P file transfer.
//
// Flow: both sides open a WebSocket to the signaling server (see /server) to
// exchange a short room code and then WebRTC offer/answer/ICE messages. Once
// the RTCPeerConnection's data channel opens, the signaling server is no
// longer involved — file bytes stream directly between browsers (or through
// a TURN relay if a direct path can't be established), never touching our
// servers.
//
// The connection itself lives in peerLink.ts, which this drives exactly one of.
// Group sharing (groupTransfer.ts) drives many of the same thing; everything in
// this file is about the room and about turning arriving chunks back into
// files, which is the half that does not generalise.
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

export type { FileProgress } from "./peerLink";

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
   * The short code both devices derive from the two connection keys, once
   * they are connected. Identical on both ends when nobody is in the middle,
   * different when somebody is — see verificationCode.ts.
   */
  onVerificationCode?: (code: string) => void;
  /**
   * Something worth telling the user that is not a failure — currently the
   * storage-headroom warning. It needs its own channel: routing it through
   * onStatus meant the message rode along as a detail on a non-error status,
   * and the UI only reads detail when the status IS an error, so it was
   * silently dropped every time.
   */
  onNotice?: (message: string) => void;
  /** Group receivers only: which device of how many this one is. */
  onGroupPosition?: (position: number, maxReceivers: number) => void;
}

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

// How often arriving-file progress may reach the UI. Matches the sending side's
// interval in peerLink.ts — the UI cannot show more than a few updates a second
// either way, and every one of them is a re-render competing with the transfer.
const RECEIVE_PROGRESS_INTERVAL_MS = 60;

import { sanitizeFilename } from "./sanitize";
import { countTransfer } from "./metrics";
import { formatBytes } from "./format";
import {
  PeerLink,
  createIceServerProvider,
  type ControlMessage,
  type FileProgress,
  type SignalData,
} from "./peerLink";

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

export function signalingUrl(): string {
  return process.env.NEXT_PUBLIC_SIGNALING_URL || "ws://localhost:8080";
}

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
export const RECEIVED_BLOB_TYPE = "application/octet-stream";

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
  private link: PeerLink | null = null;
  private readonly iceServers = createIceServerProvider();
  private readonly role: "sender" | "receiver";
  private readonly callbacks: PeerTransferCallbacks;
  private roomCode: string | null = null;
  private connectAttempt = 0;
  private closedByUser = false;
  private signalingCloseTimer: ReturnType<typeof setTimeout> | null = null;
  /** Keeps an idle signaling socket from being closed by a proxy — see KEEPALIVE_INTERVAL_MS. */
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
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
  /** Timestamp of the last progress callback — see emitProgress. */
  private lastProgressAt = 0;

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

  /**
   * Receiver: join a group share instead of a 1:1 room.
   *
   * Receiving is the same job either way — one connection to one sender, and
   * every byte arrives down it identically — so this reuses everything below
   * rather than duplicating it. All that differs is the verb, which room map
   * the server looks in, and that the sender is talking to other devices at the
   * same time, which is their problem and not this one's.
   */
  connectAsGroupReceiver(code: string, secret?: string | null) {
    this.callbacks.onStatus?.("connecting-signal");
    this.openSocket(() => this.send({ type: "join-group", code, secret: secret ?? undefined }));
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
        if (!this.link?.isOpen) {
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
          void this.ensureLink().ensureConnection();
          break;
        case "group-joined":
          // Same moment as "peer-joined", plus where this device sits in the
          // group. Worth showing: it is the receiver's own answer to "did the
          // right number of people get this?", from the one source that knows.
          this.callbacks.onGroupPosition?.(Number(msg.position) || 1, Number(msg.maxReceivers) || 1);
          this.callbacks.onStatus?.("negotiating");
          void this.ensureLink().ensureConnection();
          break;
        case "signal":
          this.ensureLink().enqueueSignal(msg.data as SignalData);
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

  /** Idempotent — safe to call from both the "peer-joined" handler and a racing "signal" message. */
  private ensureLink(): PeerLink {
    if (this.link) return this.link;
    this.link = new PeerLink(this.role, this.iceServers, {
      onSignal: (data) => this.send({ type: "signal", data }),
      onOpen: () => {
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
      },
      onClose: () => this.callbacks.onStatus?.("done"),
      onData: (data) => this.handleChannelMessage(data),
      onProgress: (p) => this.callbacks.onProgress?.(p),
      onError: (message) => this.callbacks.onError?.(message),
      onVerificationCode: (code) => this.callbacks.onVerificationCode?.(code),
      onIceSettled: () => this.closeSignalingNow(),
    });
    return this.link;
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
   * Progress is throttled rather than emitted per chunk. Every call here is a
   * React state update on the other side of the callback; at one per 16KB chunk
   * a 29MB file queued ~1,850 re-renders that competed with the transfer itself
   * for the main thread. Always emits the final value so the bar lands on 100%.
   *
   * The sending side has its own copy of this inside PeerLink, for the same
   * reason and with the same interval. This one covers the receiving side,
   * where the chunks arrive rather than leave.
   */
  private emitProgress(progress: FileProgress, force = false) {
    const now = Date.now();
    if (!force && now - this.lastProgressAt < RECEIVE_PROGRESS_INTERVAL_MS) return;
    this.lastProgressAt = now;
    this.callbacks.onProgress?.(progress);
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

  /** Sender: stream one or more files over the open data channel, one at a time. */
  async sendFiles(files: File[]) {
    const link = this.link;
    if (!link || !link.isOpen) throw new Error("Data channel is not open yet.");
    this.callbacks.onStatus?.("transferring");
    await link.sendFiles(files);
    this.callbacks.onStatus?.("done");
  }

  /**
   * Closes the signaling socket once ICE has settled rather than the moment the
   * data channel opens, so late candidates can still arrive and let the
   * connection upgrade off the relay. The deadline is a backstop: if ICE never
   * reaches a terminal state we still stop talking to the server.
   */
  private scheduleSignalingClose() {
    if (this.signalingCloseTimer !== null) return;
    this.signalingCloseTimer = setTimeout(() => this.closeSignalingNow(), SIGNALING_GRACE_MS);
  }

  private closeSignalingNow() {
    if (this.signalingCloseTimer !== null) {
      clearTimeout(this.signalingCloseTimer);
      this.signalingCloseTimer = null;
    }
    this.signalingClosedByUs = true;
    this.ws?.close();
  }

  /** Tears down the peer connection without marking the whole transfer closed by the user. */
  private teardownPeer() {
    this.link?.close();
    this.link = null;
  }

  close() {
    if (this.signalingCloseTimer !== null) {
      clearTimeout(this.signalingCloseTimer);
      this.signalingCloseTimer = null;
    }
    this.stopKeepalive();
    this.signalingClosedByUs = true;
    this.closedByUser = true;
    this.sink?.terminate();
    this.sink = null; // suppress any in-flight retry from firing after a deliberate close
    this.link?.close();
    this.link = null;
    this.ws?.close();
  }
}
