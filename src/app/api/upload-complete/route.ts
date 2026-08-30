import { NextResponse } from "next/server";
import { isR2Configured, completeMultipartUpload } from "@/lib/r2";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json({ error: "Link-based sharing isn't configured on this deployment yet." }, { status: 503 });
  }
  if (isRateLimited(clientIpFromHeaders(request.headers), 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const { token, uploadId, parts } = body ?? {};
  if (
    typeof token !== "string" ||
    !/^[a-f0-9]{32}$/.test(token) ||
    typeof uploadId !== "string" ||
    !Array.isArray(parts) ||
    parts.length === 0 ||
    !parts.every((p) => Number.isInteger(p?.partNumber) && typeof p?.etag === "string")
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    await completeMultipartUpload(token, uploadId, parts);
  } catch {
    return NextResponse.json({ error: "Could not finalize the upload. The parts may be incomplete — try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
