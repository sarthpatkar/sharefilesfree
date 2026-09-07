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

  // The longer code has to be joinable, or the feature is decorative. It now
  // needs the room secret alongside it — the digits alone are deliberately not
  // enough for a room that stays open for hours (see generateRoomSecret).
  const longReceiver = connect();
  await new Promise((r) => longReceiver.once("open", r));
  longReceiver.send(JSON.stringify({ type: "join-room", code: longRoom.code, secret: longRoom.secret }));
  const joinedLong = await once(longReceiver, (m) => m.type === "peer-joined" || m.type === "error");
  console.log("✅ an 8-digit code plus its secret can be joined:", joinedLong.type === "peer-joined");
  if (joinedLong.type !== "peer-joined") throw new Error("expected an 8-digit code with its secret to be joinable");

  // A long-lived room must not be openable by its digits alone.
  //
  // The guess arithmetic at the top of index.js scales with the number of open
  // rooms, which is the one variable that grows when the service succeeds — so a
  // code that stays valid for hours cannot be the only thing protecting a file.
  // These assert the secret is actually enforced, and (just as important) that
  // failing it is indistinguishable from a wrong code.
  const secretSender = connect();
  await new Promise((r) => secretSender.once("open", r));
  secretSender.send(JSON.stringify({ type: "create-room", ttlMinutes: 120 }));
  const secretRoom = await once(secretSender, (m) => m.type === "room-created");
  console.log("✅ a long room is issued a secret:", typeof secretRoom.secret === "string" && secretRoom.secret.length >= 20);
  if (typeof secretRoom.secret !== "string" || secretRoom.secret.length < 20) {
    throw new Error("expected a long-lived room to be issued a high-entropy secret");
  }

  const guesser = connect();
  await new Promise((r) => guesser.once("open", r));
  guesser.send(JSON.stringify({ type: "join-room", code: secretRoom.code }));
  const guessResult = await once(guesser, (m) => m.type === "error" || m.type === "peer-joined");
  console.log("✅ the code alone will not open a long room:", guessResult.type === "error");
  if (guessResult.type !== "error") throw new Error("a long-lived room was joinable without its secret");

  // The refusal must be word-for-word the refusal a wrong code gets, or a
  // guesser learns they found a live room and only need the secret.
  const stranger2 = connect();
  await new Promise((r) => stranger2.once("open", r));
  stranger2.send(JSON.stringify({ type: "join-room", code: "00000001" }));
  const unknownCodeError = await once(stranger2, (m) => m.type === "error");
  console.log("✅ a wrong secret is indistinguishable from a wrong code:", guessResult.message === unknownCodeError.message);
  if (guessResult.message !== unknownCodeError.message) {
    throw new Error("a correct code with a bad secret answered differently from an unknown code — that leaks");
  }

  const wrongSecret = connect();
  await new Promise((r) => wrongSecret.once("open", r));
  wrongSecret.send(JSON.stringify({ type: "join-room", code: secretRoom.code, secret: "not-the-right-secret" }));
  const wrongSecretResult = await once(wrongSecret, (m) => m.type === "error" || m.type === "peer-joined");
  console.log("✅ a wrong secret is rejected:", wrongSecretResult.type === "error");
  if (wrongSecretResult.type !== "error") throw new Error("a wrong secret was accepted");

  const rightful = connect();
  await new Promise((r) => rightful.once("open", r));
  rightful.send(JSON.stringify({ type: "join-room", code: secretRoom.code, secret: secretRoom.secret }));
  const rightfulResult = await once(rightful, (m) => m.type === "peer-joined" || m.type === "error");
  console.log("✅ code plus secret opens it:", rightfulResult.type === "peer-joined");
  if (rightfulResult.type !== "peer-joined") throw new Error("the correct code and secret were refused");

  // The read-aloud default must keep working with no secret at all, or the
  // whole point of the short code is gone.
  const shortRoomSender = connect();
  await new Promise((r) => shortRoomSender.once("open", r));
  shortRoomSender.send(JSON.stringify({ type: "create-room", ttlMinutes: 10 }));
  const readAloud = await once(shortRoomSender, (m) => m.type === "room-created");
  const readAloudReceiver = connect();
  await new Promise((r) => readAloudReceiver.once("open", r));
  readAloudReceiver.send(JSON.stringify({ type: "join-room", code: readAloud.code }));
  const readAloudJoin = await once(readAloudReceiver, (m) => m.type === "peer-joined" || m.type === "error");
  console.log("✅ the short read-aloud code still needs no secret:", readAloudJoin.type === "peer-joined");
  if (readAloudJoin.type !== "peer-joined") throw new Error("a 10-minute room should still join by code alone");

  secretSender.close();
  guesser.close();
  stranger2.close();
  wrongSecret.close();
  rightful.close();
  shortRoomSender.close();
  readAloudReceiver.close();

  // The idle socket the whole product rests on.
  //
  // Behind Cloudflare's proxy an idle WebSocket is closed after about 100
  // seconds, which killed the room and broke every code that wasn't redeemed
  // within two minutes — see HEARTBEAT_INTERVAL_MS in index.js. Nothing about
  // that is visible locally, so it is asserted here instead: an idle socket
  // must be pinged, and a client keepalive must not be treated as a protocol
  // error. Run the server with SIGNALING_HEARTBEAT_MS set low to exercise it
  // without waiting for the real cadence.
  const heartbeatMs = Number(process.env.SIGNALING_HEARTBEAT_MS) || 30000;
  const idler = connect();
  await new Promise((r) => idler.once("open", r));

  const gotPing = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), heartbeatMs * 2 + 2000);
    idler.once("ping", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
  console.log("✅ an idle socket gets pinged:", gotPing);
  if (!gotPing) throw new Error("expected the server to ping an idle socket, or a proxy will close it");

  // A keepalive from the client must be accepted silently. If it fell through
  // to the default branch the server would answer every one with an error, and
  // the client's own half of the heartbeat would become a stream of failures.
  idler.send(JSON.stringify({ type: "keepalive" }));
  const keepaliveRejected = await Promise.race([
    once(idler, (m) => m.type === "error").then(() => true).catch(() => false),
    new Promise((r) => setTimeout(() => r(false), 500)),
  ]);
  console.log("✅ a client keepalive is accepted silently:", !keepaliveRejected);
  if (keepaliveRejected) throw new Error("keepalive should not be answered with an error");

  idler.close();

  // --- Hardening checks -----------------------------------------------------

  // A WebSocket handshake ignores the same-origin policy, so without this any
  // page anywhere could open sockets from its visitors' browsers and spend
  // their real IP addresses guessing codes — turning a per-IP limit into no
  // limit at all. A browser sets Origin itself and a page cannot forge it,
  // which is exactly the case this stops.
  const foreign = new WebSocket(URL, { origin: "https://evil.example" });
  const foreignRejected = await new Promise((resolve) => {
    foreign.on("open", () => resolve(false));
    foreign.on("error", () => resolve(true));
  });
  console.log("✅ a socket from an unlisted origin is refused:", foreignRejected);
  if (!foreignRejected) throw new Error("expected a foreign Origin to be refused");

  // The site's own origin must still work, or the check has broken the product.
  const ownOrigin = new WebSocket(URL, { origin: "https://sharefilesfree.com" });
  const ownAccepted = await new Promise((resolve) => {
    ownOrigin.on("open", () => resolve(true));
    ownOrigin.on("error", () => resolve(false));
  });
  console.log("✅ the site's own origin is still accepted:", ownAccepted);
  if (!ownAccepted) throw new Error("the real site must still be able to connect");
  ownOrigin.close();

  // `ws` defaults to a 100 MiB frame ceiling. This server's largest honest
  // message is a few KB of SDP, so anything approaching that is an attempt to
  // spend the box's memory — it must be refused by the protocol layer rather
  // than parsed.
  const fat = connect();
  await new Promise((r) => fat.once("open", r));
  const fatClosed = new Promise((resolve) => fat.on("close", () => resolve(true)));
  fat.send(JSON.stringify({ type: "keepalive", padding: "x".repeat(200 * 1024) }));
  const oversizeRefused = await Promise.race([
    fatClosed,
    new Promise((r) => setTimeout(() => r(false), 2000)),
  ]);
  console.log("✅ an oversized frame is refused:", oversizeRefused);
  if (!oversizeRefused) throw new Error("expected an oversized frame to close the socket");

  // One socket needs one room to send and one to receive. Claiming them without
  // limit is how a caller who knows codes takes delivery slots for transfers
  // that were not theirs, or holds the room map open at someone else's expense.
  const hoarder = connect();
  await new Promise((r) => hoarder.once("open", r));
  let refusedAt = 0;
  for (let i = 1; i <= 8; i++) {
    hoarder.send(JSON.stringify({ type: "create-room" }));
    const reply = await once(hoarder, (m) => m.type === "room-created" || m.type === "error");
    if (reply.type === "error" && !refusedAt) refusedAt = i;
  }
  console.log("✅ one socket cannot hold unlimited rooms, refused at:", refusedAt);
  if (refusedAt === 0) throw new Error("expected a per-socket room ceiling");
  hoarder.close();

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
