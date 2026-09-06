// Counts a handful of named events. Holds totals, never records.
//
// See src/lib/metrics.ts for the privacy constraint this is built around: no
// identifier, no cookie, nothing about an individual transfer. The request's IP
// is used for a rate limit and then forgotten, which is the same handling the
// privacy policy already describes for every other endpoint.
//
// The numbers live in this process's memory and die with it. That is a real
// limitation — a restart resets them, and a second instance would count
// separately — and it is the right trade today: the alternative is a database,
// which is a far bigger privacy and cost story than the question deserves.
// Read them with GET and record them somewhere durable if they ever need to
// survive a deploy.
import { NextResponse } from "next/server";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

const COUNTABLE = ["connection-direct", "connection-relay", "connection-failed", "transfer-complete"] as const;
type Countable = (typeof COUNTABLE)[number];

const counters: Record<Countable, number> = {
  "connection-direct": 0,
  "connection-relay": 0,
  "connection-failed": 0,
  "transfer-complete": 0,
};

const since = Date.now();

export async function POST(request: Request) {
  // A generous ceiling: a busy transfer reports about three of these. Anything
  // past it is a script, and a script inflating a counter only corrupts our own
  // numbers — so this is about keeping the data honest, not about protecting a
  // resource.
  if (isRateLimited(`metrics:${clientIpFromHeaders(request.headers)}`, 30, 60 * 1000)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = (await request.json()) as { event?: unknown };
    // Allowlisted, so an arbitrary key can never be used to grow this object.
    if (typeof body.event === "string" && (COUNTABLE as readonly string[]).includes(body.event)) {
      counters[body.event as Countable] += 1;
    }
  } catch {
    // Malformed body. Nothing to count, nothing to report.
  }

  // 204 always: the caller is fire-and-forget and must never retry or surface
  // anything, including our own failures.
  return new NextResponse(null, { status: 204 });
}

/**
 * The operational view. The ratio that matters is
 * relay / (direct + relay) — every point of it is real money at scale.
 */
export async function GET() {
  const direct = counters["connection-direct"];
  const relay = counters["connection-relay"];
  const attempts = direct + relay;

  return NextResponse.json({
    since: new Date(since).toISOString(),
    ...counters,
    relayRatio: attempts === 0 ? null : Number((relay / attempts).toFixed(4)),
    connectSuccessRatio:
      attempts + counters["connection-failed"] === 0
        ? null
        : Number((attempts / (attempts + counters["connection-failed"])).toFixed(4)),
  });
}
