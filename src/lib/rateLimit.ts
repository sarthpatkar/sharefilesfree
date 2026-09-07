// Minimal in-memory fixed-window rate limiter, shared by API routes that can
// cost us real money or be abused (upload URL issuance, TURN credential
// issuance). Mirrors the same pattern used in server/index.js for room
// creation.
//
// Caveat: this state lives in a single Node process's memory. It's a real
// deterrent for casual abuse and costs nothing to run, but it resets on
// deploy/restart and doesn't share state across multiple instances. If this
// app is ever deployed behind multiple server instances, swap this for a
// shared store (e.g. Cloudflare KV or Redis) — the interface below is
// deliberately tiny so that's a drop-in change.

interface Window {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Window>();

export function isRateLimited(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

interface Budget {
  used: number;
  windowStart: number;
}

const budgets = new Map<string, Budget>();

/**
 * A rate limit measured in bytes rather than requests, for the one thing where
 * counting requests is the wrong unit.
 *
 * Ten uploads an hour was a fine ceiling when an upload was capped at 2GB —
 * twenty gigabytes, which is affordable to eat. The same ten uploads at the
 * current 50GB ceiling is half a terabyte an hour from a single connection.
 * What needs bounding is the storage, so the storage is what gets counted.
 *
 * The amount is charged when the request is ALLOWED, not when the bytes
 * actually arrive — an upload that is authorised and then abandoned still
 * counts, which errs in the safe direction and needs no completion callback.
 */
export function wouldExceedByteBudget(key: string, bytes: number, budget: number, windowMs: number): boolean {
  const entry = budgets.get(key);
  const used = entry && Date.now() - entry.windowStart <= windowMs ? entry.used : 0;
  return used + bytes > budget;
}

/**
 * Charges an authorised upload against the budget. Kept separate from the check
 * above so a request that is refused further down — a failed ad, say — doesn't
 * spend quota it never used. Getting that backwards means an honest sender
 * whose ad won't load burns their own hour.
 */
export function chargeByteBudget(key: string, bytes: number, windowMs: number): void {
  const now = Date.now();
  const entry = budgets.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    budgets.set(key, { used: bytes, windowStart: now });
    return;
  }
  entry.used += bytes;
}

// Both maps are keyed by caller-controlled values (an IP, or an IP plus a
// token) and nothing removed from them, so on a long-running process they only
// ever grew — an unbounded allocation an anonymous caller controls. The
// signaling server has swept its equivalent for a while; this side never did.
// An entry whose window has passed is dead, because the next request from that
// key starts a fresh one anyway.
const LONGEST_WINDOW_MS = 60 * 60 * 1000;

const sweeper = setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) if (now - bucket.windowStart > LONGEST_WINDOW_MS) buckets.delete(key);
  for (const [key, budget] of budgets) if (now - budget.windowStart > LONGEST_WINDOW_MS) budgets.delete(key);
}, 5 * 60 * 1000);
if (typeof sweeper === "object" && "unref" in sweeper) sweeper.unref();

/** Test seam — clears both the request counters and the byte budgets. */
export function __resetRateLimits() {
  buckets.clear();
  budgets.clear();
}

/**
 * The caller's IP, as far as it can be established — and deliberately NOT the
 * first entry in X-Forwarded-For.
 *
 * This used to read `x-forwarded-for.split(",")[0]`, which is the leftmost
 * entry, which is the one value in the whole chain that the caller writes
 * themselves. X-Forwarded-For is append-only: every proxy adds the address it
 * received the connection from and leaves what was already there alone. So a
 * request that arrives carrying `X-Forwarded-For: 1.2.3.4` reaches this
 * function as `1.2.3.4, <real client>, <edge>` — and the old code returned
 * 1.2.3.4. Every rate limit keyed on it was therefore bypassed by sending one
 * header and changing it each time, which defeats the limiter on this route
 * (TURN credentials, which cost real money to relay) and the one on /api/metrics
 * (which keeps the public counters honest).
 *
 * The order below is smallest-trust-first:
 *
 *   1. CF-Connecting-IP. Cloudflare sets this itself and overwrites any value
 *      the client supplied, so it cannot be forged THROUGH the proxy. It can
 *      still be forged by a caller who reaches the origin directly, which is
 *      why the origin must only accept connections from Cloudflare's ranges —
 *      see deploy/harden.sh. Header trust and network trust are one control,
 *      not two; neither half works alone.
 *   2. The RIGHTMOST X-Forwarded-For entry, which was written by the nearest
 *      proxy rather than by the caller — the correct fallback when the chain
 *      length isn't known.
 *
 * A missing IP returns a constant rather than something unique-per-request:
 * a limiter keyed on an unknown-but-distinct value is not a limiter at all.
 */
export function clientIpFromHeaders(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip");
  if (cf) return cf.trim();

  const fwd = headers.get("x-forwarded-for");
  if (fwd) {
    const hops = fwd.split(",").map((h) => h.trim()).filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }

  return headers.get("x-real-ip")?.trim() || "unknown";
}
