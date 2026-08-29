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

export function clientIpFromHeaders(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return headers.get("x-real-ip") || "unknown";
}
