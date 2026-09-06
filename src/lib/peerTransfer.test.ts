// Tests for the signalling half of PeerTransfer — the part that decides whether
// two browsers ever find a path to each other.
//
// The bug these exist to prevent is invisible in normal use and expensive when
// it happens: ICE candidates that arrived while a remote description was still
// being applied were thrown away, which quietly pushed connections onto the
// paid TURN relay (or lost them entirely). It never reproduced on loopback,
// so a test is the only place it can be caught.
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PeerTransfer } from "./peerTransfer";

/** Lets a test drive the socket the class opened. */
let socket: FakeSocket;
let peer: FakePeerConnection;

// Registered through a function rather than assigning `this` to a variable,
// which the lint rules forbid and which reads worse anyway.
function rememberSocket(s: FakeSocket) {
  socket = s;
}
function rememberPeer(p: FakePeerConnection) {
  peer = p;
}

class FakeSocket {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  readyState = 1;
  sent: unknown[] = [];
  static OPEN = 1;

  constructor() {
    rememberSocket(this);
  }
  send(raw: string) {
    this.sent.push(JSON.parse(raw));
  }
  close() {
    this.readyState = 3;
  }

  /** Deliver a server message to the class under test. */
  deliver(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

class FakePeerConnection {
  remoteDescription: unknown = null;
  localDescription: unknown = { type: "answer", sdp: "LOCAL" };
  connectionState = "new";
  iceConnectionState = "new";
  sctp = { maxMessageSize: 65536 };
  onicecandidate: unknown = null;
  onconnectionstatechange: unknown = null;
  ondatachannel: unknown = null;

  /** Every candidate that actually reached the connection, in order. */
  addedCandidates: RTCIceCandidateInit[] = [];
  /** Ordered log of operations, to assert serialisation. */
  static log: string[] = [];

  addEventListener() {}
  getStats() {
    return Promise.resolve(new Map());
  }
  close() {}
  createDataChannel() {
    return { close() {}, addEventListener() {}, removeEventListener() {} };
  }

  async setRemoteDescription(desc: unknown) {
    FakePeerConnection.log.push("setRemoteDescription:start");
    // The real call is genuinely async and takes a few milliseconds. That gap
    // is precisely the window the old code dropped candidates in, so the fake
    // has to reproduce it rather than resolve immediately.
    await new Promise((r) => setTimeout(r, 20));
    this.remoteDescription = desc;
    FakePeerConnection.log.push("setRemoteDescription:end");
  }

  async createAnswer() {
    return { type: "answer", sdp: "ANSWER" };
  }

  async setLocalDescription() {}

  async addIceCandidate(candidate: RTCIceCandidateInit) {
    // Mirrors the browser: adding a candidate with no remote description throws.
    if (!this.remoteDescription) throw new Error("InvalidStateError");
    FakePeerConnection.log.push("addIceCandidate");
    this.addedCandidates.push(candidate);
  }
}

beforeEach(() => {
  FakePeerConnection.log = [];
  vi.stubGlobal("WebSocket", FakeSocket);
  vi.stubGlobal(
    "RTCPeerConnection",
    class extends FakePeerConnection {
      constructor() {
        super();
        rememberPeer(this);
      }
    },
  );
  // TURN is not configured in tests; the class falls back to STUN.
  vi.stubGlobal("fetch", vi.fn(async () => ({ json: async () => ({ turnConfigured: false }) })));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Lets queued promise chains settle. */
const settle = () => new Promise((r) => setTimeout(r, 60));

describe("ICE candidate handling", () => {
  it("applies a candidate that arrives before the remote description is set", async () => {
    const transfer = new PeerTransfer("receiver", {});
    transfer.connectAsReceiver("123456");
    socket.onopen?.();

    socket.deliver({ type: "peer-joined" });
    await settle();

    // The real ordering: an offer, then candidates hard on its heels — inside
    // the window where setRemoteDescription has not resolved yet.
    socket.deliver({ type: "signal", data: { kind: "offer", sdp: { type: "offer", sdp: "OFFER" } } });
    socket.deliver({ type: "signal", data: { kind: "candidate", candidate: { candidate: "first" } } });
    socket.deliver({ type: "signal", data: { kind: "candidate", candidate: { candidate: "second" } } });
    await settle();

    // Both survive. Before the fix these threw InvalidStateError into an empty
    // catch and were gone for good.
    expect(peer.addedCandidates.map((c) => c.candidate)).toEqual(["first", "second"]);
  });

  it("never adds a candidate before the remote description is in place", async () => {
    const transfer = new PeerTransfer("receiver", {});
    transfer.connectAsReceiver("123456");
    socket.onopen?.();
    socket.deliver({ type: "peer-joined" });
    await settle();

    socket.deliver({ type: "signal", data: { kind: "offer", sdp: { type: "offer", sdp: "OFFER" } } });
    socket.deliver({ type: "signal", data: { kind: "candidate", candidate: { candidate: "first" } } });
    await settle();

    const firstAdd = FakePeerConnection.log.indexOf("addIceCandidate");
    const remoteSet = FakePeerConnection.log.indexOf("setRemoteDescription:end");
    expect(firstAdd).toBeGreaterThan(-1);
    expect(firstAdd).toBeGreaterThan(remoteSet);
  });

  it("answers an offer, so the sender is not left waiting", async () => {
    const transfer = new PeerTransfer("receiver", {});
    transfer.connectAsReceiver("123456");
    socket.onopen?.();
    socket.deliver({ type: "peer-joined" });
    await settle();

    socket.deliver({ type: "signal", data: { kind: "offer", sdp: { type: "offer", sdp: "OFFER" } } });
    await settle();

    const answer = socket.sent.find(
      (m) => (m as { type: string; data?: { kind?: string } }).data?.kind === "answer",
    );
    expect(answer).toBeDefined();
  });

  it("keeps signals in arrival order rather than racing them", async () => {
    const transfer = new PeerTransfer("receiver", {});
    transfer.connectAsReceiver("123456");
    socket.onopen?.();
    socket.deliver({ type: "peer-joined" });
    await settle();

    socket.deliver({ type: "signal", data: { kind: "offer", sdp: { type: "offer", sdp: "OFFER" } } });
    for (let i = 0; i < 5; i++) {
      socket.deliver({ type: "signal", data: { kind: "candidate", candidate: { candidate: `c${i}` } } });
    }
    await settle();

    expect(peer.addedCandidates.map((c) => c.candidate)).toEqual(["c0", "c1", "c2", "c3", "c4"]);
  });
});
