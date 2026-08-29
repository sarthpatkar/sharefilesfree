// Issues a token + presigned upload URL for the "receiver isn't online right
// now" fallback path. The actual file bytes go straight from the browser to
// R2 via the presigned URL returned here — this route only ever handles a
// small JSON request/response, never the file itself.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isR2Configured, writeMetadata, getUploadUrl, hashPassword } from "@/lib/r2";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";
import { sanitizeFilename } from "@/lib/sanitize";

// scrypt's cost scales with input size, so an unbounded password is a cheap
// way to peg the CPU on every upload request — cap it well above anything a
// real password would need.
const MAX_PASSWORD_LENGTH = 256;
const MAX_MIME_LENGTH = 255;

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const DEFAULT_EXPIRY_HOURS = 24;
const DEFAULT_MAX_EXPIRY_HOURS = 24 * 7; // 7 days — matches what competitors offer free (see the plan's research)

// Room-code generation on the P2P path is naturally rate-limited by the
// signaling server; this path costs us real storage/bandwidth, so it gets
// the same per-IP throttle, tuned tighter since a "share a link" upload is
// a much lower-frequency action than opening a P2P session.
const CREATE_LIMIT = 10;
const CREATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json(
      { error: "Link-based sharing isn't configured on this deployment yet." },
      { status: 503 },
    );
  }

  if (isRateLimited(clientIpFromHeaders(request.headers), CREATE_LIMIT, CREATE_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many uploads requested. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const { name, size, mime, password, burnAfterDownload } = body ?? {};
  if (typeof name !== "string" || name.length === 0 || typeof size !== "number" || size <= 0) {
    return NextResponse.json({ error: "Missing or invalid file name/size." }, { status: 400 });
  }
  if (typeof password === "string" && password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Password is too long." }, { status: 400 });
  }

  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES) || DEFAULT_MAX_BYTES;
  if (size > maxBytes) {
    return NextResponse.json({ error: `File is too large for link sharing (max ${Math.round(maxBytes / 1e9)}GB).` }, { status: 413 });
  }

  // The requester can pick a shorter retention window, but never longer than the
  // deployment's configured ceiling — keeps worst-case storage cost bounded regardless.
  const maxExpiryHours = Number(process.env.UPLOAD_EXPIRY_HOURS) || DEFAULT_MAX_EXPIRY_HOURS;
  const requestedHours = Number(body?.expiryHours) || DEFAULT_EXPIRY_HOURS;
  const expiryHours = Math.min(Math.max(requestedHours, 1), maxExpiryHours);
  const expiresAt = Date.now() + expiryHours * 60 * 60 * 1000;

  const token = randomBytes(16).toString("hex"); // unguessable — this is the only thing standing between a link and the file
  const { hash, salt } = typeof password === "string" && password.length > 0 ? hashPassword(password) : { hash: undefined, salt: undefined };

  const safeMime = typeof mime === "string" && mime.length <= MAX_MIME_LENGTH ? mime : "application/octet-stream";

  await writeMetadata(token, {
    name: sanitizeFilename(name),
    size,
    mime: safeMime,
    expiresAt,
    passwordHash: hash,
    passwordSalt: salt,
    burnAfterDownload: Boolean(burnAfterDownload),
  });
  const uploadUrl = await getUploadUrl(token);

  return NextResponse.json({ token, uploadUrl, expiresAt });
}
