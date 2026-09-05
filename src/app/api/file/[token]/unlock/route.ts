// Verifies a password-protected shared link and, only on success, hands back
// the real metadata + a presigned download URL. Separate from the plain GET
// on /api/file/[token] specifically so an unauthenticated request never sees
// the filename or gets a download URL for a protected link.
import { NextResponse } from "next/server";
import { readMetadata, verifyPassword, getDownloadUrl, markDownloaded, sweepIfConsumed, isR2Configured } from "@/lib/r2";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

// Tight limit — this is the brute-force guard for the password itself. Keyed by
// IP+token so it can't be used to lock other people out of a link they do know
// the password for, only to slow down guessing against one you don't.
const ATTEMPT_LIMIT = 8;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isR2Configured() || !/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  if (isRateLimited(`${clientIpFromHeaders(request.headers)}:${token}`, ATTEMPT_LIMIT, ATTEMPT_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const { password } = await request.json().catch(() => ({}) as { password?: string });
  const meta = await readMetadata(token);
  if (!meta) return NextResponse.json({ error: "This link doesn't exist or has already expired." }, { status: 404 });
  if (Date.now() > meta.expiresAt) return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  if (meta.consumedAt) {
    await sweepIfConsumed(token, meta);
    return NextResponse.json({ error: "This was a one-time link and has already been downloaded." }, { status: 410 });
  }
  if (meta.blocked) return NextResponse.json({ error: "This link was reported and has been taken down." }, { status: 410 });

  if (!meta.passwordHash || !meta.passwordSalt || typeof password !== "string" || !verifyPassword(password, meta.passwordSalt, meta.passwordHash)) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const downloadUrl = await getDownloadUrl(token, meta.name);
  if (meta.burnAfterDownload) await markDownloaded(token);
  return NextResponse.json({ name: meta.name, size: meta.size, mime: meta.mime, expiresAt: meta.expiresAt, downloadUrl });
}
