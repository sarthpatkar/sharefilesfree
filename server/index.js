// SendFilesFree signaling server.
//
// This process does ONE job: pair a sender and receiver by a short room code,
// then relay WebRTC offer/answer/ICE-candidate messages between them so they
// can open a direct peer-to-peer connection. It never sees file contents —
// once the peers are connected, all file bytes flow browser-to-browser (or
// through a TURN relay), completely bypassing this server.
//
// Deploy this as a small, cheap, always-on process (e.g. a $5-6/mo VPS).
// It holds only in-memory state, so a restart just drops in-flight pairings
// (harmless — clients simply reconnect and get a new code).

import { createServer } from "node:http";
import { WebSocketServer } from "ws";
import crypto from "node:crypto";

const PORT = process.env.PORT || 8080;

// How long an unclaimed room code stays valid. The sender picks from this list;
// ten minutes is the default and anything longer is opt-in.
//
// The upload fallback used to be where a file waited for a receiver who wasn't
// around. That path is gone, so the room does the job instead: the sender keeps
// the tab open and the code keeps working. A room costs a few bytes and two
// socket references, so length is not a resource question — it is a brute-force
// question, and it is answered by the code getting longer with the clock (see
// generateRoomCode).
const ROOM_TTL_CHOICES_MIN = [10, 30, 60, 120];
const DEFAULT_ROOM_TTL_MIN = 10;

/** A room longer than this gets a longer code — see generateRoomCode. */
const SHORT_CODE_MAX_MIN = 10;

function clampRoomTtlMinutes(requested) {
  const n = Number(requested);
  if (!Number.isFinite(n)) return DEFAULT_ROOM_TTL_MIN;
  // Snap to the nearest allowed value rather than trusting an arbitrary number,
  // so a hand-crafted client can't ask for a week.
  return ROOM_TTL_CHOICES_MIN.includes(n) ? n : DEFAULT_ROOM_TTL_MIN;
}

// Basic per-IP abuse throttle: cap how many rooms one IP can open per window.
const ROOM_CREATE_LIMIT = 30;
const ROOM_CREATE_WINDOW_MS = 60 * 1000;

// A hard ceiling on rooms held at once, across everyone.
//
// Every other limit here is per-IP or per-window, which bounds the RATE at
// which rooms appear but not the TOTAL, and the two are not the same thing
// once rooms live for up to two hours: thirty a minute per address, sustained,
// is far more than a million over a two-hour TTL. Two things break at that
// point and both are severe — the six-digit space fills, so honest senders
// can no longer be issued a code, and the process holds a map it cannot
// shrink until the TTLs expire.
//
// Ten thousand is far above any plausible real concurrency for this service
// and roughly one percent of the smaller code space, which keeps collisions
// rare enough that the bounded draw above effectively never fails.
const MAX_ROOMS = 10_000;

// How many rooms one socket may hold. A socket needs exactly one to send and
// one to receive; anything past a handful is not a use of the product.
//
// Without this, one connection could create rooms up to its IP's rate limit
// forever, or — worse on the receiving side — claim room after room. A claimed
// room is closed to the receiver it was meant for ("already claimed"), so a
// caller who knows or guesses codes could silently take delivery slots for
// transfers that were not theirs, one socket, no limit. Successful joins are
// not rate limited anywhere else, on purpose: a real receiver must never be
// throttled for typing a correct code.
const MAX_ROOMS_PER_SOCKET = 5;

// The biggest frame this server will accept.
//
// `ws` defaults to 100 MiB per message, which for a process whose entire
// vocabulary is short JSON control frames is an invitation: a handful of
// concurrent sockets each sending a maximal frame is gigabytes of buffer on a
// 4 GB box. The largest legitimate message here is an SDP offer with a full
// candidate list, which is single-digit kilobytes; 64 KB leaves an order of
// magnitude of headroom and still refuses anything abusive at the protocol
// layer, before this file's own code ever sees it.
const MAX_PAYLOAD_BYTES = 64 * 1024;

// Ceiling on relayed signaling frames per socket — see the "signal" case.
const SIGNAL_LIMIT = 300;
const SIGNAL_WINDOW_MS = 60 * 1000;

// Origins allowed to open a signaling socket.
//
// A WebSocket handshake is not subject to the same-origin policy — any page on
// any domain can open one to this server from a visitor's browser, and it will
// carry that visitor's real IP. That turns every rate limit here from
// "attacker needs many addresses" into "attacker needs many visitors", which
// is a far cheaper thing to buy: one ad impression or one popular page with a
// hidden script is thousands of real, un-throttleable addresses guessing codes
// on their behalf.
//
// Checking Origin does not stop a determined attacker — a non-browser client
// sets any header it likes — but it is precisely the control that stops the
// browser-driven version, because a browser sets Origin itself and a page
// cannot lie about it. It is worth having for exactly that case.
const ALLOWED_ORIGINS = (process.env.SIGNALING_ALLOWED_ORIGINS ||
  "https://sharefilesfree.com,https://www.sharefilesfree.com")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Codes are only 6 digits (1,000,000 combinations) — without a throttle here,
// an attacker could brute-force an active stranger's room code by just
// guessing rapidly. This limit is generous enough for a human mistyping a
// code a few times, but makes guessing impractical from any single address.
const JOIN_ATTEMPT_LIMIT = 20;
const JOIN_ATTEMPT_WINDOW_MS = 60 * 1000;

// The per-IP limit above is worthless against someone with a thousand IPs, and
// a botnet is cheap. So failed joins are also counted globally. Two properties
// make this safe to run:
//
//   - Only FAILURES count. A join that names a real, unclaimed room is let
//     through no matter how loud the noise is, so an attacker cannot flood the
//     limiter to lock out real users — which is the usual reason not to have a
//     global limit at all.
//   - A guesser learns nothing from being throttled: a wrong code answers the
//     same either way.
//
// What matters is not how long a room lives but how many guesses can be thrown
// at it in that time, against how large the code space is. Both halves move
// together here, which is why a two-hour room is safer than the ten-minute one
// this started with:
//
//   originally  10 min, 6 digits, 200 fails/10s -> 12,000 guesses / 1e6 = 0.012 R
//   now  (10m)  10 min, 6 digits, 100 fails/10s ->  6,000 guesses / 1e6 = 0.006 R
//   now (120m) 120 min, 8 digits, 100 fails/10s -> 72,000 guesses / 1e8 = 0.0007 R
//
// where R is the number of rooms open and the result is the expected number of
// lucky guesses per room lifetime. Both current cases beat the original. Change
// either the durations or the code lengths and this arithmetic has to be redone
// — that is the whole point of writing it down.
//
// Tightening this cannot lock out a real receiver: a join naming a live room is
// resolved before any limiter is consulted, so only wrong codes are counted.
const GLOBAL_FAIL_LIMIT = 100;
const GLOBAL_FAIL_WINDOW_MS = 10 * 1000;
let globalFails = { count: 0, windowStart: 0 };

// How often every open socket is pinged, and how many pings may go unanswered
// before it is torn down.
//
// This is not a nicety — without it the product's headline feature does not
// work in production at all, and the reason is invisible in development.
//
// The site sits behind Cloudflare's proxy, which closes a WebSocket that has
// carried no traffic for about 100 seconds. Nothing here ever spoke on an idle
// socket: a sender created a room and then both sides went quiet until a
// receiver typed the code. Measured against the live deployment, the socket was
// killed at ~124 seconds with close code 1006 (an abnormal close, no close
// frame) — which fired `close` here, deleted the room, and left the sender
// staring at a code the server had already forgotten. So a code advertised as
// good for ten minutes, or two hours, stopped working after two minutes.
//
// It never reproduced locally because local development connects straight to
// ws://localhost:8080 with no proxy in between, and `ws` does not time out idle
// connections of its own accord.
//
// A ping is answered by the browser's own network stack rather than by page
// JavaScript, so it keeps working while the sender's tab is backgrounded —
// which matters here more than usual, since "leave the tab open" IS the
// product. Traffic flows both ways every interval and the idle timer never
// reaches its ceiling.
//
// Any interval comfortably under Cloudflare's ~100s works; 30 seconds costs a
// couple of bytes per socket per half-minute and leaves room for a missed one.
//
// The env override exists only so the integration test can run a fast heartbeat
// rather than waiting half a minute for one tick. Production leaves it unset.
const HEARTBEAT_INTERVAL_MS = Number(process.env.SIGNALING_HEARTBEAT_MS) || 30 * 1000;

// Tolerating two misses before terminating is deliberate. One missed pong on a
// phone changing cells is not a dead peer, and killing it would drop the room
// this whole mechanism exists to keep alive. Three intervals is ~90 seconds,
// still inside the window Cloudflare would have allowed anyway.
const MAX_MISSED_PONGS = 2;

/**
 * The guess budget shrinks as the number of open rooms grows.
 *
 * The arithmetic above is written per-room, and its answer scales with R — the
 * count of rooms currently open. A fixed budget therefore gets steadily weaker
 * the more successful the service becomes, which is exactly backwards. Holding
 * the budget inversely proportional to R keeps the expected number of lucky
 * guesses roughly flat instead of letting it grow with traffic.
 *
 * Be clear about what this does and does not buy. It is harm reduction for the
 * short read-aloud code, not a fix: a six-digit space is genuinely too small at
 * high R, and the real answer there is either a longer code or asking the sender
 * to confirm the join. Long-lived rooms don't rely on this at all — they require
 * a 128-bit secret and are unaffected by guess volume.
 *
 * It cannot lock out a real receiver: a join naming a live room is resolved
 * before any limiter is consulted, so only wrong codes are ever counted.
 */
const GLOBAL_FAIL_BASELINE_ROOMS = 1000;
const GLOBAL_FAIL_MIN_LIMIT = 5;

function currentGlobalFailLimit() {
  const openRooms = rooms.size;
  if (openRooms <= GLOBAL_FAIL_BASELINE_ROOMS) return GLOBAL_FAIL_LIMIT;
  const scaled = Math.floor((GLOBAL_FAIL_LIMIT * GLOBAL_FAIL_BASELINE_ROOMS) / openRooms);
  return Math.max(GLOBAL_FAIL_MIN_LIMIT, scaled);
}

/** Counts a failed join globally and reports whether the ceiling is now exceeded. */
function globalFailureExceeded() {
  const now = Date.now();
  if (now - globalFails.windowStart > GLOBAL_FAIL_WINDOW_MS) {
    globalFails = { count: 1, windowStart: now };
    return false;
  }
  globalFails.count += 1;
  return globalFails.count > currentGlobalFailLimit();
}

/** @type {Map<string, { sender: import("ws").WebSocket, receiver: import("ws").WebSocket | null, createdAt: number, ttlMs: number }>} */
const rooms = new Map();

/** @type {Map<string, { count: number, windowStart: number }>} */
const rateLimitBuckets = new Map();

/**
 * The connecting client's IP — and deliberately NOT the first X-Forwarded-For
 * entry, which is the one value in the chain the client writes themselves.
 *
 * X-Forwarded-For is append-only: each proxy appends the address it received
 * the connection from and leaves earlier entries untouched. A client that
 * connects carrying `X-Forwarded-For: 1.2.3.4` therefore arrives here as
 * `1.2.3.4, <real client>, <edge>`, and reading `[0]` — which this did — hands
 * back the attacker's own string.
 *
 * Everything protective in this file is keyed on the value below. With a
 * forgeable key, ROOM_CREATE_LIMIT and JOIN_ATTEMPT_LIMIT are both bypassed by
 * sending one header and varying it per connection, which leaves only the
 * global failure ceiling standing between a guesser and the six-digit code
 * space. That is not what the arithmetic at the top of this file assumes.
 *
 * CF-Connecting-IP is preferred because Cloudflare writes it itself and
 * overwrites any client-supplied copy, so it cannot be forged through the
 * proxy. It CAN be forged by anyone who reaches this origin directly, which is
 * why the box must refuse connections that did not come from Cloudflare — see
 * deploy/harden.sh. The header rule and the firewall rule are one control
 * split across two files; neither is worth anything on its own.
 */
function clientIp(req) {
  const cf = req.headers["cf-connecting-ip"];
  if (typeof cf === "string" && cf.length > 0) return cf.trim();

  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) {
    const hops = fwd.split(",").map((h) => h.trim()).filter(Boolean);
    // Rightmost: written by the nearest proxy rather than by the caller.
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return req.socket.remoteAddress || "unknown";
}

function isRateLimited(key, limit, windowMs) {
  const now = Date.now();
  const entry = rateLimitBuckets.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitBuckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

/**
 * Six digits for a short room, eight for a long one.
 *
 * This used to be the security argument: a code guessable for two hours needed a
 * bigger haystack than one guessable for ten minutes. That job now belongs to
 * the room secret (see generateRoomSecret), which is 128 bits and does it far
 * better than two extra digits ever could.
 *
 * What is left is a capacity argument, which is worth keeping. Codes must be
 * unique among open rooms, and the loop below retries on collision — at a
 * million combinations that starts costing attempts once a few thousand rooms
 * are open at once, and long-lived rooms are precisely the ones that accumulate.
 * A hundred million combinations makes that a non-question.
 *
 * The length is invisible either way: a long-lived room's code is never shown to
 * anyone. It travels inside the link as a routing key, because the secret it
 * needs alongside it cannot be read down a phone.
 */
function generateRoomCode(ttlMinutes) {
  const digits = ttlMinutes > SHORT_CODE_MAX_MIN ? 8 : 6;
  const ceiling = 10 ** digits;

  // Bounded, because the obvious `do { ... } while (rooms.has(code))` is an
  // unbounded loop over a space an anonymous caller can fill. Six digits is a
  // million codes; a caller who occupies most of them makes each new draw
  // collide, and if the space is ever exhausted the loop never terminates at
  // all — on a single-threaded process that is not a slow path, it is the
  // whole server stopping, with every open transfer on it.
  //
  // MAX_ROOMS below is what actually prevents that state. This bound is the
  // second line: with the map capped well under the space, twenty draws
  // failing is statistically impossible rather than merely unlikely, so
  // returning null here means something is wrong that retrying will not fix.
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = crypto.randomInt(0, ceiling).toString().padStart(digits, "0");
    if (!rooms.has(code)) return code;
  }
  return null;
}

/**
 * The unguessable half of a long-lived room.
 *
 * Six digits is a million combinations, and the arithmetic above assumes an
 * attacker is spending guesses against however many rooms happen to be open.
 * That assumption is the problem: expected lucky guesses scale with the NUMBER
 * OF OPEN ROOMS, which is the one variable that grows when the service
 * succeeds. At a few thousand concurrent rooms a six-digit code is found by
 * brute force in minutes, and no rate limit fixes it — throttling far enough to
 * matter would also throttle real receivers mistyping a code.
 *
 * So a room that lives longer than the read-it-aloud default gets 128 bits of
 * randomness that must be presented alongside the code. It costs nothing in
 * usability, and that is not a coincidence — it is the same observation already
 * made in generateRoomCode. Nobody asks for a two-hour code unless the other
 * person ISN'T there, in which case it is being sent as a link or a QR anyway
 * and its length is invisible.
 */
function generateRoomSecret() {
  return crypto.randomBytes(16).toString("base64url");
}

/**
 * Compares in constant time, so the comparison itself doesn't leak how much of
 * a guessed secret was correct.
 */
function secretMatches(expected, provided) {
  if (typeof provided !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function send(ws, message) {
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function cleanupRoomsFor(ws) {
  for (const [code, room] of rooms.entries()) {
    if (room.sender === ws) {
      send(room.receiver, { type: "peer-left" });
      // The receiver's hold is released too — the room it was counted against
      // is gone. Without this its socket keeps paying for a room that no
      // longer exists and eventually cannot join anything.
      if (room.receiver) room.receiver.roomsHeld = Math.max(0, (room.receiver.roomsHeld ?? 0) - 1);
      rooms.delete(code);
    } else if (room.receiver === ws) {
      send(room.sender, { type: "peer-left" });
      room.receiver = null; // let the sender's room stay open for a new receiver
    }
  }
  ws.roomsHeld = 0;
}

// Periodic sweep of stale, never-joined rooms — and of the rate-limit
// buckets, which are keyed by IP and were never removed. Rooms expire, so the
// rooms map stays bounded; the bucket map only ever grew, which on a
// long-running process is an unbounded allocation an anonymous caller controls.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (!room.receiver && now - room.createdAt > room.ttlMs) {
      send(room.sender, { type: "room-expired" });
      // Release the sender's hold along with the room, or a long-lived socket
      // that outlives several expiries slowly runs out of its own budget.
      if (room.sender) room.sender.roomsHeld = Math.max(0, (room.sender.roomsHeld ?? 0) - 1);
      rooms.delete(code);
    }
  }

  // A bucket is dead once its window has passed — the next request from that
  // IP would start a fresh one anyway. Both windows are a minute, so anything
  // older than that is safe to drop.
  const bucketMaxAge = Math.max(ROOM_CREATE_WINDOW_MS, JOIN_ATTEMPT_WINDOW_MS);
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (now - bucket.windowStart > bucketMaxAge) rateLimitBuckets.delete(key);
  }
}, 30 * 1000).unref();

const httpServer = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({
  server: httpServer,
  maxPayload: MAX_PAYLOAD_BYTES,
  verifyClient({ origin, req }, done) {
    // No Origin header at all means a non-browser client. Those are allowed:
    // this check exists to stop a hostile PAGE driving other people's
    // browsers (see ALLOWED_ORIGINS), and refusing header-less clients would
    // break curl-based health checks and the integration test without
    // stopping anyone who can set a header.
    if (!origin) return done(true);
    if (ALLOWED_ORIGINS.includes(origin)) return done(true);
    // Localhost in any port, for development against a local Next.js.
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return done(true);
    console.warn(`Refused signaling socket from origin ${origin} (${clientIp(req)})`);
    return done(false, 403, "Forbidden origin");
  },
});

// Pings every socket on a fixed cadence, and reaps the ones that stopped
// answering.
//
// The second half is a fix in its own right: `cleanupRoomsFor` only ran on a
// `close` event, and a connection that dies without one — a laptop lid closed,
// a phone off network — never fired it. Its room sat in the map holding a dead
// socket until its TTL expired, and the sender's peer, if any, was never told.
// A socket that misses its pings is exactly that case, and terminating it
// raises the `close` this file already knows how to handle.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.missedPongs >= MAX_MISSED_PONGS) {
      ws.terminate(); // fires "close" -> cleanupRoomsFor
      continue;
    }
    ws.missedPongs = (ws.missedPongs ?? 0) + 1;
    ws.ping();
  }
}, HEARTBEAT_INTERVAL_MS).unref();

wss.on("connection", (ws, req) => {
  const ip = clientIp(req);

  // Reset by every pong, incremented by every ping that goes out — see the
  // heartbeat sweep above.
  ws.missedPongs = 0;
  ws.on("pong", () => {
    ws.missedPongs = 0;
  });

  // How many rooms this socket currently holds, as sender or receiver — see
  // MAX_ROOMS_PER_SOCKET.
  ws.roomsHeld = 0;

  // Per-socket key for the signal relay limiter. Keyed on the socket rather
  // than the IP on purpose: two people behind one NAT negotiating at the same
  // time are two independent transfers and must not share a budget.
  ws.signalKey = crypto.randomUUID();

  ws.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return send(ws, { type: "error", message: "Malformed message." });
    }

    switch (msg.type) {
      case "create-room": {
        if (isRateLimited(`create:${ip}`, ROOM_CREATE_LIMIT, ROOM_CREATE_WINDOW_MS)) {
          return send(ws, { type: "error", message: "Too many rooms created. Try again in a minute." });
        }
        if (ws.roomsHeld >= MAX_ROOMS_PER_SOCKET) {
          return send(ws, { type: "error", message: "Too many open transfers on this connection." });
        }
        if (rooms.size >= MAX_ROOMS) {
          // Deliberately not an obscure failure: this is the service being
          // full, and the sender needs to know to try again rather than sit
          // waiting on a code that was never issued.
          return send(ws, { type: "error", message: "The service is busy right now. Please try again in a moment." });
        }
        const ttlMinutes = clampRoomTtlMinutes(msg.ttlMinutes);
        const code = generateRoomCode(ttlMinutes);
        if (!code) {
          return send(ws, { type: "error", message: "The service is busy right now. Please try again in a moment." });
        }
        // Only long-lived rooms get one. The ten-minute default exists to be
        // read aloud, and a secret would make that impossible — see
        // generateRoomSecret for why that trade is the right way round.
        const secret = ttlMinutes > SHORT_CODE_MAX_MIN ? generateRoomSecret() : null;
        rooms.set(code, { sender: ws, receiver: null, createdAt: Date.now(), ttlMs: ttlMinutes * 60 * 1000, secret });
        ws.roomCode = code;
        ws.roomsHeld += 1;
        send(ws, {
          type: "room-created",
          code,
          secret,
          ttlMinutes,
          expiresAt: Date.now() + ttlMinutes * 60 * 1000,
        });
        break;
      }

      case "join-room": {
        // Deliberately ordered: look the room up BEFORE consulting any limiter.
        // The old order charged every attempt, successful ones included, against
        // a per-IP budget — so a household behind one NAT could lock itself out
        // by receiving a few files, while an attacker spread over many IPs was
        // barely inconvenienced. Limits now apply only to attempts that failed,
        // which is the only kind a guesser can make.
        const code = typeof msg.code === "string" && /^(\d{6}|\d{8})$/.test(msg.code) ? msg.code : null;
        const room = code ? rooms.get(code) : undefined;

        // A room whose secret doesn't match is treated as if it did not exist —
        // same branch, same message, same rate-limit charge. Answering a correct
        // code differently from a wrong one would tell a guesser they had found
        // a live room and only needed the secret, which is precisely the
        // information the secret exists to withhold.
        const authorised = room && (!room.secret || secretMatches(room.secret, msg.secret));

        if (!authorised) {
          const tooManyFromThisIp = isRateLimited(`join:${ip}`, JOIN_ATTEMPT_LIMIT, JOIN_ATTEMPT_WINDOW_MS);
          const tooManyOverall = globalFailureExceeded();
          if (tooManyFromThisIp || tooManyOverall) {
            return send(ws, { type: "error", message: "Too many attempts. Try again in a minute." });
          }
          return send(ws, { type: "error", message: "That code is invalid or has expired." });
        }
        if (room.receiver) {
          return send(ws, { type: "error", message: "That code has already been claimed." });
        }
        // Claiming is the one privileged thing a correct code buys, and a
        // claimed room is closed to everyone else — so the number of them one
        // socket may hold has to be bounded even though the joins are
        // legitimate. Nothing else limits a SUCCESSFUL join, deliberately: a
        // real receiver typing a real code must never be throttled.
        if (ws.roomsHeld >= MAX_ROOMS_PER_SOCKET) {
          return send(ws, { type: "error", message: "Too many open transfers on this connection." });
        }
        room.receiver = ws;
        ws.roomCode = code;
        ws.roomsHeld += 1;
        send(room.sender, { type: "peer-joined" });
        send(ws, { type: "peer-joined" });
        break;
      }

      // The browser cannot see a ping frame or send one — the WebSocket API
      // deliberately hides them from page JavaScript — so a client that wants
      // to prove the link is alive has to send a real message. This is that
      // message, and answering it would only double the traffic: receiving it
      // has already reset the proxy's idle timer, which is the entire point.
      case "keepalive":
        break;

      case "signal": {
        const room = rooms.get(ws.roomCode);
        if (!room) return;
        // Relaying is the one thing this server does that forwards
        // caller-controlled bytes to another person, and until now it did so
        // without limit. Two ends of a room could therefore use it as a free
        // general-purpose message relay — the data channel it exists to
        // negotiate, except carried by us, at our cost, forever — and one end
        // could flood the other with frames the browser has to parse.
        //
        // Real negotiation is an offer, an answer, and a burst of trickled
        // candidates: tens of messages over a few seconds, not hundreds a
        // minute sustained. This is set far enough above that to be invisible
        // to an honest peer on a bad network with many candidates, and far
        // enough below a useful relay to make the abuse pointless. Frame size
        // is already capped by maxPayload at the protocol layer.
        if (isRateLimited(`signal:${ws.signalKey}`, SIGNAL_LIMIT, SIGNAL_WINDOW_MS)) return;
        const other = room.sender === ws ? room.receiver : room.sender;
        send(other, { type: "signal", data: msg.data });
        break;
      }

      default:
        send(ws, { type: "error", message: `Unknown message type: ${msg.type}` });
    }
  });

  ws.on("close", () => cleanupRoomsFor(ws));
  ws.on("error", () => cleanupRoomsFor(ws));
});

httpServer.listen(PORT, () => {
  console.log(`SendFilesFree signaling server listening on :${PORT}`);
});
