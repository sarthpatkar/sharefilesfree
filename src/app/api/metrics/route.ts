// Counts a handful of named events. Holds totals, never records.
//
// See src/lib/metrics.ts for the privacy constraint this is built around: no
// identifier, no cookie, nothing about an individual transfer. The request's IP
// is used for a rate limit and then forgotten, which is the same handling the
// privacy policy already describes for every other endpoint.
//
// WHY THESE ARE WRITTEN TO DISK
// -----------------------------
// They started in memory only, which was fine while the only reader was me with
// a curl. It stops being fine the moment /stats is a public page: the counters
// reset on every deploy, so a visitor would see a site that had apparently
// moved four files ever. Numbers shown to the public have to survive a restart
// or they are worse than no numbers at all.
//
// The file lives in systemd's StateDirectory (/var/lib/sharefilesfree), which is
// the one path the service unit can write to — everything else is read-only
// under ProtectSystem=strict, and .next is swapped out wholesale on every
// deploy. See deploy/app.service.
//
// It holds seven integers. There is nothing in it about anyone.
import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

interface Counters {
  "connection-direct": number;
  "connection-relay": number;
  "connection-failed": number;
  "transfer-complete": number;
  visit: number;
  files: number;
  bytes: number;
  largestFileBytes: number;
  since: number;
}

const EMPTY: Counters = {
  "connection-direct": 0,
  "connection-relay": 0,
  "connection-failed": 0,
  "transfer-complete": 0,
  visit: 0,
  files: 0,
  bytes: 0,
  largestFileBytes: 0,
  since: Date.now(),
};

/**
 * systemd sets STATE_DIRECTORY when the unit declares StateDirectory=. It can
 * be a colon-separated list, so take the first. Falls back to a temp path for
 * local development, where losing the numbers costs nothing.
 */
function stateDir(): string {
  const fromSystemd = process.env.STATE_DIRECTORY?.split(":")[0];
  return fromSystemd || join(tmpdir(), "sharefilesfree");
}

const STATS_FILE = join(stateDir(), "stats.json");

function load(): Counters {
  try {
    const parsed = JSON.parse(readFileSync(STATS_FILE, "utf8")) as Partial<Counters>;
    // Merge onto EMPTY so a file written by an older build, missing a counter
    // this one knows about, reads as zero rather than undefined.
    const merged = { ...EMPTY, ...parsed };
    for (const key of Object.keys(EMPTY) as (keyof Counters)[]) {
      if (typeof merged[key] !== "number" || !Number.isFinite(merged[key])) merged[key] = EMPTY[key];
    }
    return merged;
  } catch {
    // No file yet, or it is unreadable. Starting from zero is correct and the
    // only safe answer — never let a bad read take the endpoint down.
    return { ...EMPTY, since: Date.now() };
  }
}

const counters: Counters = load();

// Writes are debounced: a busy transfer reports several events in a few seconds
// and there is no reason for each to touch the disk. Losing the last few
// seconds of counting to an unclean shutdown is an acceptable trade for not
// writing on every beacon.
const FLUSH_DELAY_MS = 5000;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      mkdirSync(stateDir(), { recursive: true });
      // Written to a temp name and renamed, so a crash mid-write cannot leave a
      // truncated file that reads as zero on the next boot.
      const tmp = `${STATS_FILE}.tmp`;
      writeFileSync(tmp, JSON.stringify(counters));
      renameSync(tmp, STATS_FILE);
    } catch {
      // Read-only filesystem, missing StateDirectory, disk full. The counters
      // keep working in memory; only durability is lost, and that must never
      // become an error the caller sees.
    }
  }, FLUSH_DELAY_MS);
  flushTimer.unref?.();
}

/** Clamps anything a browser sends. These are public totals; keep them sane. */
function positiveInt(value: unknown, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(Math.floor(n), max);
}

const MAX_FILES_PER_BATCH = 10_000;
const MAX_BYTES_PER_BATCH = 5 * 1024 ** 4; // 5TB — generous, but not "someone typed a number"

export async function POST(request: Request) {
  // A busy transfer reports a handful of these. Anything past the ceiling is a
  // script, and a script inflating a counter only corrupts our own numbers — so
  // this is about keeping the published figures honest, not protecting a resource.
  if (isRateLimited(`metrics:${clientIpFromHeaders(request.headers)}`, 30, 60 * 1000)) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const event = body.event;

    if (event === "transfer-complete") {
      counters["transfer-complete"] += 1;
      counters.files += positiveInt(body.files, MAX_FILES_PER_BATCH);
      counters.bytes += positiveInt(body.bytes, MAX_BYTES_PER_BATCH);
      const largest = positiveInt(body.largest, MAX_BYTES_PER_BATCH);
      if (largest > counters.largestFileBytes) counters.largestFileBytes = largest;
      scheduleFlush();
    } else if (
      event === "connection-direct" ||
      event === "connection-relay" ||
      event === "connection-failed" ||
      event === "visit"
    ) {
      counters[event] += 1;
      scheduleFlush();
    }
  } catch {
    // Malformed body. Nothing to count, nothing to report.
  }

  // 204 always: the caller is fire-and-forget and must never retry or surface
  // anything, including our own failures.
  return new NextResponse(null, { status: 204 });
}

/**
 * The public view, read by /stats and by anyone curious enough to ask directly.
 *
 * `relayRatio` is the operationally important one: relayed bytes are what this
 * service actually pays for, so that ratio times traffic is the hosting bill.
 */
export async function GET() {
  const direct = counters["connection-direct"];
  const relay = counters["connection-relay"];
  const connected = direct + relay;
  const attempted = connected + counters["connection-failed"];

  return NextResponse.json(
    {
      since: new Date(counters.since).toISOString(),
      visits: counters.visit,
      transfers: counters["transfer-complete"],
      files: counters.files,
      bytes: counters.bytes,
      largestFileBytes: counters.largestFileBytes,
      connectionsDirect: direct,
      connectionsRelayed: relay,
      connectionsFailed: counters["connection-failed"],
      relayRatio: connected === 0 ? null : Number((relay / connected).toFixed(4)),
      connectSuccessRatio: attempted === 0 ? null : Number((connected / attempted).toFixed(4)),
      // Stated rather than computed, because it is the point of the whole
      // architecture and it is the one number that can never move.
      bytesStored: 0,
    },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30" } },
  );
}
