// Looks up a shared-link token's metadata. If the link isn't password
// protected, hands back a fresh presigned download URL directly. If it is,
// this deliberately withholds the download URL (and the filename) — see
// /api/file/[token]/unlock, which requires the password first. The download
// itself always happens directly between the browser and R2; this route
// never streams file bytes.
import { NextResponse } from "next/server";
import { readMetadata, getDownloadUrl, markDownloaded, sweepIfConsumed, isR2Configured } from "@/lib/r2";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!isR2Configured() || !/^[a-f0-9]{32}$/.test(token)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const meta = await readMetadata(token);
  if (!meta) {
    return NextResponse.json({ error: "This link doesn't exist or has already expired." }, { status: 404 });
  }
  if (Date.now() > meta.expiresAt) {
    // The R2 lifecycle rule will physically delete the object soon (see README) —
    // treat it as gone from the moment it's past its stated expiry regardless.
    return NextResponse.json({ error: "This link has expired." }, { status: 410 });
  }
  // A one-time link that has been opened is a different thing from a reported
  // one, and used to be told to the visitor as "this was reported and taken
  // down" — which is both wrong and alarming. Now it says what happened.
  if (meta.consumedAt) {
    await sweepIfConsumed(token, meta);
    return NextResponse.json({ error: "This was a one-time link and has already been downloaded." }, { status: 410 });
  }
  if (meta.blocked) {
    return NextResponse.json({ error: "This link was reported and has been taken down." }, { status: 410 });
  }

  if (meta.passwordHash) {
    return NextResponse.json({ requiresPassword: true });
  }

  const downloadUrl = await getDownloadUrl(token, meta.name);
  if (meta.burnAfterDownload) await markDownloaded(token);
  return NextResponse.json({ name: meta.name, size: meta.size, mime: meta.mime, expiresAt: meta.expiresAt, downloadUrl });
}
