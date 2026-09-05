// Redeems a finished ad session for a one-use receipt.
//
// Returns 425 ("Too Early") with how long is left when the clock hasn't run,
// rather than a generic 400 — the client uses that to re-arm its timer instead
// of giving up, which matters on a backgrounded tab where setTimeout is
// throttled and the local countdown finishes late.
import { NextResponse } from "next/server";
import { completeAdSession } from "@/lib/adGate";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

const LIMIT = 240;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  if (isRateLimited(`ad-complete:${clientIpFromHeaders(request.headers)}`, LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const sessionId = body?.sessionId;
  if (typeof sessionId !== "string" || !/^[a-f0-9]{32}$/.test(sessionId)) {
    return NextResponse.json({ error: "Invalid session." }, { status: 400 });
  }

  const result = completeAdSession(sessionId);
  if (!result.ok) {
    const status = result.retryAfterMs ? 425 : 400;
    return NextResponse.json({ error: result.error, retryAfterMs: result.retryAfterMs }, { status });
  }

  return NextResponse.json({ receipt: result.receipt });
}
