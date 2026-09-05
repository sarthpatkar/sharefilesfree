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

// How long an unclaimed room code stays valid before it's swept away.
//
// An hour, not the ten minutes this started with. The reason is that the
// "receiver isn't online right now" fallback used to be an upload to rented
// storage, and that path is gone: there is no longer anywhere for a file to
// wait except the sender's own machine. So the room has to do that job — the
// sender leaves the tab open and the code keeps working while they do.
//
// This costs nothing (a room is a few bytes and two socket references) and,
// unlike the path it replaces, the file still never touches this server. What
// it does cost is exposure, and that is paid for below — see GLOBAL_FAIL_LIMIT.
const ROOM_TTL_MS = 60 * 60 * 1000;

// Basic per-IP abuse throttle: cap how many rooms one IP can open per window.
const ROOM_CREATE_LIMIT = 30;
const ROOM_CREATE_WINDOW_MS = 60 * 1000;

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
// This ceiling is what pays for the hour-long room above, and the arithmetic
// is the whole reason it moved. What matters is not how long a room lives but
// how many guesses can be thrown at it in that time:
//
//   before  10-minute room, 200 fails / 10s  ->  up to  12,000 guesses per room
//   now     60-minute room,  30 fails / 10s  ->  up to  10,800 guesses per room
//
// With R rooms open, a guess lands with probability R/1,000,000, so expected
// break-ins per room-lifetime went from 0.012R to 0.0108R. A room that lives
// six times longer is fractionally SAFER than it was, rather than six times
// more exposed. Lengthen the room again and this number has to come down again,
// or the code has to get longer.
//
// Cutting it cannot lock out a real receiver: a join naming a live room is
// resolved before any limiter is consulted, so only wrong codes are counted.
const GLOBAL_FAIL_LIMIT = 30;
const GLOBAL_FAIL_WINDOW_MS = 10 * 1000;
let globalFails = { count: 0, windowStart: 0 };

/** Counts a failed join globally and reports whether the ceiling is now exceeded. */
function globalFailureExceeded() {
  const now = Date.now();
  if (now - globalFails.windowStart > GLOBAL_FAIL_WINDOW_MS) {
    globalFails = { count: 1, windowStart: now };
    return false;
  }
  globalFails.count += 1;
  return globalFails.count > GLOBAL_FAIL_LIMIT;
}

/** @type {Map<string, { sender: import("ws").WebSocket, receiver: import("ws").WebSocket | null, createdAt: number }>} */
const rooms = new Map();

/** @type {Map<string, { count: number, windowStart: number }>} */
const rateLimitBuckets = new Map();

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
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

function generateRoomCode() {
  // 6 digits, matches the "6-digit key" UX pattern from Send Anywhere.
  let code;
  do {
    code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  } while (rooms.has(code));
  return code;
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
      rooms.delete(code);
    } else if (room.receiver === ws) {
      send(room.sender, { type: "peer-left" });
      room.receiver = null; // let the sender's room stay open for a new receiver
    }
  }
}

// Periodic sweep of stale, never-joined rooms — and of the rate-limit
// buckets, which are keyed by IP and were never removed. Rooms expire, so the
// rooms map stays bounded; the bucket map only ever grew, which on a
// long-running process is an unbounded allocation an anonymous caller controls.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (!room.receiver && now - room.createdAt > ROOM_TTL_MS) {
      send(room.sender, { type: "room-expired" });
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

const wss = new WebSocketServer({ server: httpServer });

wss.on("connection", (ws, req) => {
  const ip = clientIp(req);

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
        const code = generateRoomCode();
        rooms.set(code, { sender: ws, receiver: null, createdAt: Date.now() });
        ws.roomCode = code;
        send(ws, { type: "room-created", code });
        break;
      }

      case "join-room": {
        // Deliberately ordered: look the room up BEFORE consulting any limiter.
        // The old order charged every attempt, successful ones included, against
        // a per-IP budget — so a household behind one NAT could lock itself out
        // by receiving a few files, while an attacker spread over many IPs was
        // barely inconvenienced. Limits now apply only to attempts that failed,
        // which is the only kind a guesser can make.
        const code = typeof msg.code === "string" && /^\d{6}$/.test(msg.code) ? msg.code : null;
        const room = code ? rooms.get(code) : undefined;

        if (!room) {
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
        room.receiver = ws;
        ws.roomCode = code;
        send(room.sender, { type: "peer-joined" });
        send(ws, { type: "peer-joined" });
        break;
      }

      case "signal": {
        const room = rooms.get(ws.roomCode);
        if (!room) return;
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
