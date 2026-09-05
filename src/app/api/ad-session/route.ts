// Opens an ad session and tells the client what it has to sit through.
//
// The client sends what it wants to do; the SERVER decides the price. That
// ordering is the whole point — a client that lies about the file size gets a
// receipt priced for the size it declared, and /api/upload-url re-checks the
// real number against it (see consumeAdReceipt).
import { NextResponse } from "next/server";
import { startAdSession } from "@/lib/adGate";
import type { AdPurpose } from "@/lib/ads";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

const PURPOSES: AdPurpose[] = ["reveal-code", "receive-connect", "link-upload", "link-download"];

// Generous: a single visitor legitimately opens one of these per transfer, per
// tool hand-off, and again on every retry. This is here to stop a script
// churning session objects, not to ration honest use.
const LIMIT = 120;
const WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  if (isRateLimited(`ad-session:${clientIpFromHeaders(request.headers)}`, LIMIT, WINDOW_MS)) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const purpose = body?.purpose;
  if (!PURPOSES.includes(purpose)) {
    return NextResponse.json({ error: "Unknown ad purpose." }, { status: 400 });
  }

  const bytes = Number.isFinite(body?.bytes) && body.bytes > 0 ? Number(body.bytes) : 0;
  const hours = Number.isFinite(body?.hours) && body.hours > 0 ? Number(body.hours) : 24;

  const { sessionId, plan } = startAdSession(purpose, bytes, hours);
  return NextResponse.json({ sessionId, slots: plan.slots, secondsPerSlot: plan.secondsPerSlot, totalMs: plan.totalMs });
}
