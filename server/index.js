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
const ROOM_TTL_MS = 10 * 60 * 1000; // 10 minutes, matches Send Anywhere's key lifetime.

// Basic per-IP abuse throttle: cap how many rooms one IP can open per window.
// This is a cheap first line of defense; Phase 2 adds proper rate limiting
// and abuse reporting on the relay/storage path.
const ROOM_CREATE_LIMIT = 30;
const ROOM_CREATE_WINDOW_MS = 60 * 1000;

/** @type {Map<string, { sender: import("ws").WebSocket, receiver: import("ws").WebSocket | null, createdAt: number }>} */
const rooms = new Map();

/** @type {Map<string, { count: number, windowStart: number }>} */
const creationCounts = new Map();

function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const entry = creationCounts.get(ip);
  if (!entry || now - entry.windowStart > ROOM_CREATE_WINDOW_MS) {
    creationCounts.set(ip, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > ROOM_CREATE_LIMIT;
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

// Periodic sweep of stale, never-joined rooms.
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (!room.receiver && now - room.createdAt > ROOM_TTL_MS) {
      send(room.sender, { type: "room-expired" });
      rooms.delete(code);
    }
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
        if (isRateLimited(ip)) {
          return send(ws, { type: "error", message: "Too many rooms created. Try again in a minute." });
        }
        const code = generateRoomCode();
        rooms.set(code, { sender: ws, receiver: null, createdAt: Date.now() });
        ws.roomCode = code;
        send(ws, { type: "room-created", code });
        break;
      }

      case "join-room": {
        const room = rooms.get(msg.code);
        if (!room) {
          return send(ws, { type: "error", message: "That code is invalid or has expired." });
        }
        if (room.receiver) {
          return send(ws, { type: "error", message: "That code has already been claimed." });
        }
        room.receiver = ws;
        ws.roomCode = msg.code;
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
