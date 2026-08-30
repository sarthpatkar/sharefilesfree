// Best-effort cleanup when the client gives up on a multipart upload (e.g.
// the user cancels, or all retries on a part are exhausted). Not calling
// this isn't harmful — an abandoned incomplete multipart upload is just
// inaccessible storage until the bucket's lifecycle rule sweeps it — but
// there's no reason not to clean up proactively when we can.
import { NextResponse } from "next/server";
import { isR2Configured, abortMultipartUpload } from "@/lib/r2";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

export async function POST(request: Request) {
  if (!isR2Configured()) return NextResponse.json({ ok: true });
  if (isRateLimited(clientIpFromHeaders(request.headers), 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const { token, uploadId } = body ?? {};
  if (typeof token === "string" && /^[a-f0-9]{32}$/.test(token) && typeof uploadId === "string") {
    await abortMultipartUpload(token, uploadId);
  }
  return NextResponse.json({ ok: true });
}
