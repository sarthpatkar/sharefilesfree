// Issues a token + presigned upload URL for the "receiver isn't online right
// now" fallback path. The actual file bytes go straight from the browser to
// R2 via the presigned URL returned here — this route only ever handles a
// small JSON request/response, never the file itself.
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  isR2Configured,
  writeMetadata,
  getUploadUrl,
  hashPassword,
  createMultipartUpload,
  multipartPlan,
  MULTIPART_THRESHOLD,
} from "@/lib/r2";
import { clampRetentionHours, MAX_LINK_BYTES } from "@/lib/retention";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";
import { adsEnabled, consumeAdReceipt } from "@/lib/adGate";
import { sanitizeFilename } from "@/lib/sanitize";

// scrypt's cost scales with input size, so an unbounded password is a cheap
// way to peg the CPU on every upload request — cap it well above anything a
// real password would need.
const MAX_PASSWORD_LENGTH = 256;
const MAX_MIME_LENGTH = 255;

// The size ceiling now comes from the retention ladder's top tier (50GB) rather
// than a flat number, because the ladder is what bounds the cost: a file that
// big is only allowed to stay for hours. MAX_UPLOAD_BYTES can still lower it.
const DEFAULT_MAX_BYTES = MAX_LINK_BYTES;
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
  const { name, size, mime, password, burnAfterDownload } = body ?? {};
  if (typeof name !== "string" || name.length === 0 || typeof size !== "number" || size <= 0) {
    return NextResponse.json({ error: "Missing or invalid file name/size." }, { status: 400 });
  }
  if (typeof password === "string" && password.length > MAX_PASSWORD_LENGTH) {
    return NextResponse.json({ error: "Password is too long." }, { status: 400 });
  }

  const maxBytes = Number(process.env.MAX_UPLOAD_BYTES) || DEFAULT_MAX_BYTES;
  if (size > maxBytes) {
    return NextResponse.json(
      { error: `File is too large for link sharing (max ${Math.round(maxBytes / 1024 ** 3)}GB).` },
      { status: 413 },
    );
  }

  // What a link really buys is TIME, so that's what gets rationed: the bigger
  // the file, the shorter the window it comes with (see lib/retention.ts). Past
  // that window the sender can buy hours with attention — which is why the
  // clamp widens when ads are on, and why the receipt check below is what
  // actually decides whether those hours were paid for. A request for longer
  // than is purchasable is clamped down rather than refused.
  const ladderHours = clampRetentionHours(Number(body?.expiryHours) || DEFAULT_EXPIRY_HOURS, size, {
    adsEnabled: adsEnabled(),
    ceilingBytes: maxBytes,
  });
  if (ladderHours === null) {
    return NextResponse.json({ error: "File is too large for link sharing." }, { status: 413 });
  }
  // A deployment can still cap retention below the ladder for every file.
  const deploymentCeiling = Number(process.env.UPLOAD_EXPIRY_HOURS) || Infinity;
  const expiryHours = Math.min(ladderHours, deploymentCeiling);
  const expiresAt = Date.now() + expiryHours * 60 * 60 * 1000;

  // The ad gate, enforced — and, for a window longer than this file's base
  // tier, the thing that paid for those extra hours. Checked here rather than
  // trusted in the browser
  // because this is the request that starts costing money — a gate that lives
  // only in the page is bypassed by anyone willing to type `curl`, which is
  // exactly the population worth gating. The receipt is priced for a specific
  // size and retention (see consumeAdReceipt), so the size re-checked above is
  // the one it has to cover: watching the ads for a 10MB file cannot buy a
  // 50GB upload. No-ops entirely on a deployment with no ad network.
  if (!consumeAdReceipt(body?.adReceipt, { purpose: "link-upload", bytes: size, hours: expiryHours })) {
    return NextResponse.json({ error: "That ad wasn't completed. Try again." }, { status: 402 });
  }

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
  // Large files use multipart upload (resumable within the session — a
  // dropped connection only costs the failed part, not the whole transfer)
  // via /api/upload-part-url and /api/upload-complete. Smaller files use a
  // single presigned PUT, which is simpler and just as fast for them.
  if (size > MULTIPART_THRESHOLD) {
    const uploadId = await createMultipartUpload(token);
    // Part size grows with the file so a 50GB upload is a few hundred requests
    // rather than several thousand — see multipartPlan.
    const { partSize, totalParts } = multipartPlan(size);
    return NextResponse.json({ token, expiresAt, mode: "multipart", uploadId, partSize, totalParts });
  }

  // Signed with the exact byte count, so the size checked above is the size R2
  // will accept — not merely the size the browser claimed.
  const uploadUrl = await getUploadUrl(token, size);
  return NextResponse.json({ token, expiresAt, mode: "single", uploadUrl });
}
