// Integration smoke test for the signaling server's pairing/relay protocol,
// using two plain WebSocket clients to stand in for the sender and receiver
// browsers (no real WebRTC involved — this only exercises index.js).
//
// Run manually:  node index.js & node test-signaling.mjs
// Run in CI: see ../.github/workflows/ci.yml, which starts/stops the server around this.
import WebSocket from "ws";

const URL = process.env.SIGNALING_URL || "ws://localhost:8080";

function connect() {
  return new WebSocket(URL);
}

function once(ws, predicate) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout waiting for message")), 5000);
    ws.on("message", function handler(raw) {
      const msg = JSON.parse(raw.toString());
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.off("message", handler);
        resolve(msg);
      }
    });
  });
}

async function main() {
  const sender = connect();
  await new Promise((r) => sender.once("open", r));
  sender.send(JSON.stringify({ type: "create-room" }));
  const created = await once(sender, (m) => m.type === "room-created");
  console.log("✅ room-created:", created.code);
  if (!/^\d{6}$/.test(created.code)) throw new Error("code is not 6 digits");

  const receiver = connect();
  await new Promise((r) => receiver.once("open", r));
  receiver.send(JSON.stringify({ type: "join-room", code: created.code }));

  const [senderJoined, receiverJoined] = await Promise.all([
    once(sender, (m) => m.type === "peer-joined"),
    once(receiver, (m) => m.type === "peer-joined"),
  ]);
  console.log("✅ both sides got peer-joined:", !!senderJoined, !!receiverJoined);

  // Simulate an SDP offer/answer relay.
  sender.send(JSON.stringify({ type: "signal", data: { kind: "offer", sdp: "FAKE_OFFER" } }));
  const offerAtReceiver = await once(receiver, (m) => m.type === "signal");
  console.log("✅ offer relayed to receiver:", offerAtReceiver.data.sdp === "FAKE_OFFER");

  receiver.send(JSON.stringify({ type: "signal", data: { kind: "answer", sdp: "FAKE_ANSWER" } }));
  const answerAtSender = await once(sender, (m) => m.type === "signal");
  console.log("✅ answer relayed to sender:", answerAtSender.data.sdp === "FAKE_ANSWER");

  // Wrong/expired code should error, not hang.
  const stranger = connect();
  await new Promise((r) => stranger.once("open", r));
  stranger.send(JSON.stringify({ type: "join-room", code: "000000" }));
  const err = await once(stranger, (m) => m.type === "error");
  console.log("✅ invalid code rejected:", err.message);

  // Disconnecting the receiver should notify the sender.
  receiver.close();
  const peerLeft = await once(sender, (m) => m.type === "peer-left");
  console.log("✅ sender notified on receiver disconnect:", peerLeft.type === "peer-left");

  // Rapid-fire join attempts (guarding against room-code brute-forcing) should
  // eventually get throttled rather than being processed indefinitely.
  const flooder = connect();
  await new Promise((r) => flooder.once("open", r));
  let sawRateLimitError = false;
  for (let i = 0; i < 25 && !sawRateLimitError; i++) {
    flooder.send(JSON.stringify({ type: "join-room", code: "111111" }));
    const reply = await once(flooder, (m) => m.type === "error");
    if (reply.message.includes("Too many attempts")) sawRateLimitError = true;
  }
  console.log("✅ join-room brute-force attempts get rate limited:", sawRateLimitError);
  if (!sawRateLimitError) throw new Error("expected join-room flooding to eventually be rate limited");

  // A code's length has to track how long it stays guessable — six digits for
  // the ten-minute default, eight for anything longer. This is the property the
  // whole longer-room feature rests on, so it gets asserted rather than assumed.
  const shortSender = connect();
  await new Promise((r) => shortSender.once("open", r));
  shortSender.send(JSON.stringify({ type: "create-room", ttlMinutes: 10 }));
  const shortRoom = await once(shortSender, (m) => m.type === "room-created");
  console.log("✅ 10-minute room gets a 6-digit code:", /^\d{6}$/.test(shortRoom.code), shortRoom.code);
  if (!/^\d{6}$/.test(shortRoom.code)) throw new Error("expected a 6-digit code for a 10-minute room");

  const longSender = connect();
  await new Promise((r) => longSender.once("open", r));
  longSender.send(JSON.stringify({ type: "create-room", ttlMinutes: 120 }));
  const longRoom = await once(longSender, (m) => m.type === "room-created");
  console.log("✅ 2-hour room gets an 8-digit code:", /^\d{8}$/.test(longRoom.code), longRoom.code);
  if (!/^\d{8}$/.test(longRoom.code)) throw new Error("expected an 8-digit code for a 120-minute room");
  console.log("✅ room-created reports when it expires:", longRoom.ttlMinutes === 120 && longRoom.expiresAt > Date.now());

  // An arbitrary duration must snap to the default rather than being honoured,
  // or a hand-crafted client could ask for a room that lives for a week.
  const greedy = connect();
  await new Promise((r) => greedy.once("open", r));
  greedy.send(JSON.stringify({ type: "create-room", ttlMinutes: 100000 }));
  const greedyRoom = await once(greedy, (m) => m.type === "room-created");
  console.log("✅ an unlisted duration snaps to the default:", greedyRoom.ttlMinutes === 10);
  if (greedyRoom.ttlMinutes !== 10) throw new Error("expected an unlisted ttl to fall back to 10 minutes");

  // The longer code has to be joinable, or the feature is decorative.
  const longReceiver = connect();
  await new Promise((r) => longReceiver.once("open", r));
  longReceiver.send(JSON.stringify({ type: "join-room", code: longRoom.code }));
  const joinedLong = await once(longReceiver, (m) => m.type === "peer-joined" || m.type === "error");
  console.log("✅ an 8-digit code can be joined:", joinedLong.type === "peer-joined");
  if (joinedLong.type !== "peer-joined") throw new Error("expected an 8-digit code to be joinable");

  sender.close();
  stranger.close();
  flooder.close();
  shortSender.close();
  longSender.close();
  longReceiver.close();
  greedy.close();
  console.log("\nAll signaling protocol checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ FAILED:", err);
  process.exit(1);
});
