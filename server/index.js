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

/** @type {Map<string, { sender: import("ws").WebSocket, receiver: import("ws").WebSocket | null, createdAt: number, ttlMs: number }>} */
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

/**
 * Six digits for a short room, eight for a long one.
 *
 * The length tracks the clock because the threat does: a code that is guessable
 * for two hours needs a bigger haystack than one that is guessable for ten
 * minutes. Six digits is a million combinations, eight is a hundred million.
 *
 * It costs nothing in usability, and that is not a coincidence. A ten-minute
 * code exists to be read aloud to someone standing there. Nobody asks for two
 * hours unless the other person ISN'T there — in which case the code is being
 * sent as a link or a QR anyway, and its length is invisible.
 */
function generateRoomCode(ttlMinutes) {
  const digits = ttlMinutes > SHORT_CODE_MAX_MIN ? 8 : 6;
  const ceiling = 10 ** digits;
  let code;
  do {
    code = crypto.randomInt(0, ceiling).toString().padStart(digits, "0");
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
    if (!room.receiver && now - room.createdAt > room.ttlMs) {
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
        const ttlMinutes = clampRoomTtlMinutes(msg.ttlMinutes);
        const code = generateRoomCode(ttlMinutes);
        rooms.set(code, { sender: ws, receiver: null, createdAt: Date.now(), ttlMs: ttlMinutes * 60 * 1000 });
        ws.roomCode = code;
        send(ws, { type: "room-created", code, ttlMinutes, expiresAt: Date.now() + ttlMinutes * 60 * 1000 });
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
