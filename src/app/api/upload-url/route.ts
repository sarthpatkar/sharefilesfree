// Issues a token + presigned upload URL for the "receiver isn't online right
// now" fallback path. The actual file bytes go straight from the browser to
// R2 via the presigned URL returned here — this route only ever handles a
// small JSON request/response, never the file itself.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isR2Configured, writeMetadata, getUploadUrl } from "@/lib/r2";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2GB
const DEFAULT_EXPIRY_HOURS = 24;

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
  const { name, size, mime } = body ?? {};
  if (typeof name !== "string" || typeof size !== "number" || size <= 0) {
    return NextResponse.json({ error: "Missing or invalid file name/size." }, { status: 400 });
  }

  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES) || DEFAULT_MAX_BYTES;
  if (size > maxBytes) {
    return NextResponse.json({ error: `File is too large for link sharing (max ${Math.round(maxBytes / 1e9)}GB).` }, { status: 413 });
  }

  const token = randomBytes(16).toString("hex"); // unguessable — this is the only thing standing between a link and the file
  const expiryHours = Number(process.env.UPLOAD_EXPIRY_HOURS) || DEFAULT_EXPIRY_HOURS;
  const expiresAt = Date.now() + expiryHours * 60 * 60 * 1000;

  await writeMetadata(token, { name, size, mime: typeof mime === "string" ? mime : "application/octet-stream", expiresAt });
  const uploadUrl = await getUploadUrl(token);

  return NextResponse.json({ token, uploadUrl, expiresAt });
}
