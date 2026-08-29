// Looks up a shared-link token's metadata and hands back a fresh presigned
// download URL. The download itself happens directly between the browser
// and R2 — this route never streams file bytes.
import { NextResponse } from "next/server";
import { readMetadata, getDownloadUrl, isR2Configured } from "@/lib/r2";

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
  if (meta.blocked) {
    return NextResponse.json({ error: "This link was reported and has been taken down." }, { status: 410 });
  }

  const downloadUrl = await getDownloadUrl(token, meta.name);
  return NextResponse.json({ name: meta.name, size: meta.size, mime: meta.mime, expiresAt: meta.expiresAt, downloadUrl });
}
