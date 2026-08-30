// Issues a presigned URL for one part of a multipart upload. Called many
// times per large upload (a 500MB file at 8MB parts is ~63 calls) — that's
// all legitimate traffic from a single transfer, so this gets a much higher
// rate-limit ceiling than /api/upload-url's per-upload throttle.
import { NextResponse } from "next/server";
import { isR2Configured, getPartUploadUrl } from "@/lib/r2";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

const PART_URL_LIMIT = 1000;
const PART_URL_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json({ error: "Link-based sharing isn't configured on this deployment yet." }, { status: 503 });
  }
  if (isRateLimited(clientIpFromHeaders(request.headers), PART_URL_LIMIT, PART_URL_WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const { token, uploadId, partNumber } = body ?? {};
  if (typeof token !== "string" || !/^[a-f0-9]{32}$/.test(token) || typeof uploadId !== "string" || !Number.isInteger(partNumber) || partNumber < 1) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const url = await getPartUploadUrl(token, uploadId, partNumber);
  return NextResponse.json({ url });
}
