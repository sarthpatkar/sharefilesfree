// Group sharing: one sender, one code, many devices.
//
// The sending half of the /group feature. It owns the signaling socket and a
// PeerLink per device, and every device gets its own independent connection and
// its own copy of the file, started the moment that device joins. A phone that
// connects late still gets the whole file; a phone on a bad connection never
// holds up the laptop next to it.
//
// Receiving is NOT here. A receiver has one connection to one sender whichever
// feature it is using, so PeerTransfer.connectAsGroupReceiver handles that side
// and this file never needs a receiver role.
//
// Deliberately separate from peerTransfer.ts rather than folded into it: the
// one-to-one flow has its own room type on the server, its own code format, its
// own screens and its own security properties, and none of them should shift
// because this exists. What the two share is the connection engine in
// peerLink.ts, which is shared rather than copied so that a fix to the part
// that decides whether two browsers ever find each other lands in both.

import {
  PeerLink,
  createIceServerProvider,
  BUFFERED_AMOUNT_HIGH_WATERMARK,
  READ_SLICE_SIZE,
  type LinkTuning,
  type SignalData,
} from "./peerLink";
import { signalingUrl } from "./peerTransfer";

export type GroupStatus =
  | "idle"
  | "connecting-signal"
  | "waiting-for-devices"
  | "transferring"
  | "done"
  | "error";

export type DeviceStatus = "connecting" | "connected" | "sending" | "done" | "gone" | "error";

export interface GroupDevice {
  peerId: string;
  /** Join order, 1-based — how the roster names this device to the sender. */
  index: number;
  status: DeviceStatus;
  /** The code this device and the sender should both be showing. */
  verificationCode: string | null;
  sentBytes: number;
  totalBytes: number;
}

export interface GroupTransferCallbacks {
  onStatus?: (status: GroupStatus, detail?: string) => void;
  /** Fires once the server has issued a code, with the key and when it expires. */
  onCode?: (code: string, expiresAt: number, secret: string | null, maxDevices: number) => void;
  /** The whole roster, whenever any part of it changes. */
  onDevices?: (devices: GroupDevice[]) => void;
  /** No further devices may join — either the sender said so or the code expired. */
  onClosed?: (reason: "sender" | "expired" | "full") => void;
  onError?: (message: string) => void;
}

/**
 * The total send-buffer allowance shared across every open link.
 *
 * The per-link watermark in peerLink.ts was sized for a transfer that had one
 * link. Applied unchanged to twenty, it is up to 160MB of buffered bytes on the
 * sending device — which is not a slow transfer, it is a tab the browser kills.
 * So the budget is divided rather than repeated, with a floor low enough to stay
 * meaningful at twenty devices and high enough that the channel never starves.
 */
const TOTAL_BUFFER_BUDGET = 16 * 1024 * 1024;
const MIN_HIGH_WATERMARK = 1024 * 1024;
const MIN_READ_SLICE = 512 * 1024;

/**
 * How often the roster may reach the UI.
 *
 * Progress is already throttled per link, which is the right answer for one
 * link and the wrong one for twenty: twenty links each emitting every 60ms is
 * ~330 React updates a second, all of them competing with the transfers they
 * are describing. So the links update this object and the UI is handed the
 * whole roster on one timer instead.
 */
const ROSTER_INTERVAL_MS = 120;

const MAX_CONNECT_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const KEEPALIVE_INTERVAL_MS = 30 * 1000;

interface DeviceEntry extends GroupDevice {
  link: PeerLink;
  /** Bytes reported per file so far, so the running total can be kept by delta. */
  perFile: Map<string, number>;
}

export class GroupTransfer {
  private ws: WebSocket | null = null;
  private readonly callbacks: GroupTransferCallbacks;
  private readonly iceServers = createIceServerProvider();
  private readonly devices = new Map<string, DeviceEntry>();
  private files: File[] = [];
  private totalBytes = 0;
  private maxDevices = 2;
  private joinCount = 0;
  private accepting = true;
  private connectAttempt = 0;
  private closedByUser = false;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private rosterTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(callbacks: GroupTransferCallbacks) {
    this.callbacks = callbacks;
  }

  /**
   * Open a socket, ask for a group code, and start feeding every device that
   * turns up with it.
   *
   * The files are handed over here rather than after a connection, because
   * there is no single moment when "the connection" is ready — devices arrive
   * whenever they arrive, and each one starts from the beginning of the list.
   */
  start(files: File[], ttlMinutes: number, maxDevices: number) {
    this.files = files;
    this.totalBytes = files.reduce((sum, f) => sum + f.size, 0);
    this.maxDevices = maxDevices;
    this.callbacks.onStatus?.("connecting-signal");
    this.openSocket(() => this.send({ type: "create-group", ttlMinutes, maxDevices }));
  }

  /** Close the remaining slots by hand, without disturbing the devices already on. */
  stopAccepting() {
    if (!this.accepting) return;
    this.send({ type: "stop-accepting" });
  }

  /** Cut one device off. The rest carry on. */
  dropDevice(peerId: string) {
    this.send({ type: "drop-device", peerId });
    this.removeDevice(peerId, "gone");
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
      if (this.closedByUser) return;
      if (opened) {
        // The group died with the socket — the server holds it in memory and
        // drops it on close — so the code on screen is already meaningless and
        // devices still connected have lost their sender.
        this.callbacks.onStatus?.(
          "error",
          "The connection to the server dropped. Start again to get a new code.",
        );
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
      // Straight off the network, so an unparseable frame is ignored rather
      // than thrown out of a handler nothing is catching above.
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object") return;

      switch (msg.type) {
        case "group-created":
          this.maxDevices = Number(msg.maxReceivers) || this.maxDevices;
          this.callbacks.onCode?.(msg.code, msg.expiresAt, msg.secret ?? null, this.maxDevices);
          this.callbacks.onStatus?.("waiting-for-devices");
          break;
        case "group-joined":
          this.addDevice(String(msg.peerId));
          if (this.devices.size >= this.maxDevices) {
            this.accepting = false;
            this.callbacks.onClosed?.("full");
          }
          break;
        case "group-closed":
          this.accepting = false;
          this.callbacks.onClosed?.(msg.reason === "expired" ? "expired" : "sender");
          break;
        case "signal": {
          // Addressed. A frame with no peer on it belongs to nothing here —
          // this side never has just one connection to fall back to.
          const device = this.devices.get(String(msg.peerId));
          device?.link.enqueueSignal(msg.data as SignalData);
          break;
        }
        case "peer-left":
          if (msg.peerId) this.removeDevice(String(msg.peerId), "gone");
          break;
        case "room-expired":
          this.accepting = false;
          this.callbacks.onClosed?.("expired");
          if (this.devices.size === 0) {
            this.callbacks.onError?.("Nobody joined in time. Start again for a new code.");
          }
          break;
        case "error":
          this.callbacks.onError?.(msg.message);
          break;
      }
    };
  }

  private addDevice(peerId: string) {
    if (this.devices.has(peerId)) return;
    this.joinCount += 1;
    const index = this.joinCount;

    const link = new PeerLink(
      "sender",
      this.iceServers,
      {
        onSignal: (data) => this.send({ type: "signal", peerId, data }),
        onOpen: () => {
          this.update(peerId, { status: "connected" });
          // Each device's transfer starts from the beginning of the file list
          // the moment its own channel opens. That is the whole late-joiner
          // story: joining late is just starting late.
          void this.sendTo(peerId);
        },
        onProgress: (p) => {
          const device = this.devices.get(peerId);
          if (!device) return;
          const already = device.perFile.get(p.id) ?? 0;
          device.perFile.set(p.id, p.sent);
          device.sentBytes += p.sent - already;
          if (device.status !== "sending") device.status = "sending";
          this.scheduleRoster();
        },
        onVerificationCode: (code) => this.update(peerId, { verificationCode: code }),
        onError: () => {
          // One device failing is one row on the roster going red, not the end
          // of the share — every other device is on its own connection.
          this.update(peerId, { status: "error" });
        },
        onClose: () => {
          const device = this.devices.get(peerId);
          if (device && device.status !== "done") this.update(peerId, { status: "gone" });
        },
      },
      () => this.tuning(),
    );

    this.devices.set(peerId, {
      peerId,
      index,
      status: "connecting",
      verificationCode: null,
      sentBytes: 0,
      totalBytes: this.totalBytes,
      link,
      perFile: new Map(),
    });

    void link.ensureConnection();
    this.emitRoster();
  }

  private async sendTo(peerId: string) {
    const device = this.devices.get(peerId);
    if (!device) return;
    this.update(peerId, { status: "sending" });
    this.callbacks.onStatus?.("transferring");
    try {
      await device.link.sendFiles(this.files);
      this.update(peerId, { status: "done", sentBytes: this.totalBytes });
    } catch {
      this.update(peerId, { status: "error" });
    }
    this.reviewCompletion();
  }

  private removeDevice(peerId: string, status: DeviceStatus) {
    const device = this.devices.get(peerId);
    if (!device) return;
    device.link.close();
    // Kept on the roster rather than deleted. A device that arrived and left
    // is something the sender should still be able to see — silently removing
    // the row would erase the one record that an extra device was ever here.
    device.status = device.status === "done" ? "done" : status;
    this.emitRoster();
    this.reviewCompletion();
  }

  /**
   * Divides the send budget across the links that are actually live.
   *
   * Recomputed on every call rather than cached, because a device that joins
   * halfway through must not be handed a share worked out before it existed —
   * and the links already running have to give up part of theirs at the same
   * moment.
   */
  private tuning(): LinkTuning {
    let active = 0;
    for (const device of this.devices.values()) {
      if (device.status === "connected" || device.status === "sending") active += 1;
    }
    const share = Math.max(1, active);
    const highWatermark = Math.min(
      BUFFERED_AMOUNT_HIGH_WATERMARK,
      Math.max(MIN_HIGH_WATERMARK, Math.floor(TOTAL_BUFFER_BUDGET / share)),
    );
    const readSlice = Math.min(
      READ_SLICE_SIZE,
      Math.max(MIN_READ_SLICE, Math.floor(READ_SLICE_SIZE / share)),
    );
    return { highWatermark, lowWatermark: Math.floor(highWatermark / 4), readSlice };
  }

  /**
   * The share is finished when nothing more can happen: every device that is
   * still here has its copy, and no further device can join. Leaving it at
   * "transferring" while a slot sits open would be wrong — the sender may well
   * be waiting for someone who has not arrived yet.
   */
  private reviewCompletion() {
    if (this.devices.size === 0) return;
    const live = [...this.devices.values()].filter((d) => d.status !== "gone" && d.status !== "error");
    const allDone = live.length > 0 && live.every((d) => d.status === "done");
    const noMoreComing = !this.accepting || this.devices.size >= this.maxDevices;
    if (allDone && noMoreComing) this.callbacks.onStatus?.("done");
  }

  private update(peerId: string, patch: Partial<GroupDevice>) {
    const device = this.devices.get(peerId);
    if (!device) return;
    Object.assign(device, patch);
    this.emitRoster();
  }

  /** Coalesces roster updates onto one timer — see ROSTER_INTERVAL_MS. */
  private scheduleRoster() {
    if (this.rosterTimer !== null) return;
    this.rosterTimer = setTimeout(() => {
      this.rosterTimer = null;
      this.emitRoster();
    }, ROSTER_INTERVAL_MS);
  }

  private emitRoster() {
    this.callbacks.onDevices?.(
      [...this.devices.values()].map(({ peerId, index, status, verificationCode, sentBytes, totalBytes }) => ({
        peerId,
        index,
        status,
        verificationCode,
        sentBytes,
        totalBytes,
      })),
    );
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

  close() {
    this.closedByUser = true;
    this.stopKeepalive();
    if (this.rosterTimer !== null) {
      clearTimeout(this.rosterTimer);
      this.rosterTimer = null;
    }
    for (const device of this.devices.values()) device.link.close();
    this.devices.clear();
    this.ws?.close();
  }
}
