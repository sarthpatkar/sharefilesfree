// Issues a presigned URL for one part of a multipart upload. Called many
// times per large upload (a 500MB file at 8MB parts is ~63 calls) — that's
// all legitimate traffic from a single transfer, so this gets a much higher
// rate-limit ceiling than /api/upload-url's per-upload throttle.
//
// The length of the part is signed into the URL, which means this route has to
// know how big the file is; it reads the metadata sidecar to find out. That's
// one small JSON GET per part — a rounding error next to the 8-52MB the same
// request is about to authorise, and the price of the declared size being
// enforceable rather than advisory.
import { NextResponse } from "next/server";
import { isR2Configured, getPartUploadUrl, multipartPlan, partLength, readMetadata } from "@/lib/r2";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

// Sized for the biggest upload the ladder allows (~1,000 parts) plus retries,
// several times over. Before the part size started scaling with the file this
// was 1,000, which a 50GB upload would have exhausted on its own.
const PART_URL_LIMIT = 5000;
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

  const meta = await readMetadata(token);
  if (!meta) {
    return NextResponse.json({ error: "That upload doesn't exist or has expired." }, { status: 404 });
  }

  const { partSize, totalParts } = multipartPlan(meta.size);
  if (partNumber > totalParts) {
    return NextResponse.json({ error: "That part is past the end of the file." }, { status: 400 });
  }

  const url = await getPartUploadUrl(token, uploadId, partNumber, partLength(meta.size, partSize, partNumber));
  return NextResponse.json({ url });
}
