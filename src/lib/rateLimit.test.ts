import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { isRateLimited, wouldExceedByteBudget, chargeByteBudget, clientIpFromHeaders, __resetRateLimits } from "./rateLimit";

const GB = 1024 ** 3;

describe("isRateLimited", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows requests up to the limit, then blocks", () => {
    const key = `test-key-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(isRateLimited(key, 5, 60_000)).toBe(false);
    }
    // The 6th request within the same window exceeds the limit.
    expect(isRateLimited(key, 5, 60_000)).toBe(true);
  });

  it("resets once the window elapses", () => {
    vi.useFakeTimers();
    const key = `test-key-${Math.random()}`;
    expect(isRateLimited(key, 1, 1000)).toBe(false);
    expect(isRateLimited(key, 1, 1000)).toBe(true);

    vi.advanceTimersByTime(1001);
    expect(isRateLimited(key, 1, 1000)).toBe(false);
  });

  it("tracks separate keys independently", () => {
    const keyA = `a-${Math.random()}`;
    const keyB = `b-${Math.random()}`;
    expect(isRateLimited(keyA, 1, 60_000)).toBe(false);
    expect(isRateLimited(keyA, 1, 60_000)).toBe(true);
    // keyB's own bucket is untouched by keyA's usage.
    expect(isRateLimited(keyB, 1, 60_000)).toBe(false);
  });
});

describe("clientIpFromHeaders", () => {
  // This used to assert the opposite — that the FIRST entry wins — and that
  // assertion was the bug, written down and locked in. X-Forwarded-For is
  // append-only: each proxy adds the address it saw and leaves the rest alone,
  // so the leftmost entry is whatever the caller sent, and every limit keyed on
  // it was bypassed by sending one header and varying it per request.
  it("takes the rightmost x-forwarded-for entry, not the caller-supplied one", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" });
    expect(clientIpFromHeaders(headers)).toBe("10.0.0.1");
  });

  it("ignores a forged leading entry entirely", () => {
    // What an attacker actually sends: their own value, which the proxy chain
    // then appends the real address to.
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 198.51.100.7, 172.16.0.1" });
    expect(clientIpFromHeaders(headers)).toBe("172.16.0.1");
  });

  it("prefers CF-Connecting-IP, which Cloudflare overwrites and a caller cannot forge through it", () => {
    const headers = new Headers({
      "cf-connecting-ip": "198.51.100.9",
      "x-forwarded-for": "1.2.3.4, 10.0.0.1",
    });
    expect(clientIpFromHeaders(headers)).toBe("198.51.100.9");
  });

  it("returns a single shared key when nothing is known, never a per-request one", () => {
    // A limiter keyed on a value that differs every request is not a limiter.
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });

  it("falls back to x-real-ip", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.7" });
    expect(clientIpFromHeaders(headers)).toBe("198.51.100.7");
  });

  it("falls back to 'unknown' with no relevant headers", () => {
    expect(clientIpFromHeaders(new Headers())).toBe("unknown");
  });
});

describe("byte budget", () => {
  beforeEach(() => __resetRateLimits());

  /** What the upload route does: check, then charge only if it goes ahead. */
  function upload(key: string, bytes: number, budget = 20 * GB, windowMs = 60_000) {
    if (wouldExceedByteBudget(key, bytes, budget, windowMs)) return false;
    chargeByteBudget(key, bytes, windowMs);
    return true;
  }

  it("allows uploads that fit inside the budget", () => {
    expect(upload("ip", 5 * GB)).toBe(true);
    expect(upload("ip", 5 * GB)).toBe(true);
    expect(upload("ip", 5 * GB)).toBe(true);
  });

  it("refuses the one that would cross it", () => {
    expect(upload("ip", 15 * GB)).toBe(true);
    expect(upload("ip", 10 * GB)).toBe(false);
  });

  it("doesn't charge for a request it refused", () => {
    expect(upload("ip", 15 * GB)).toBe(true);
    expect(upload("ip", 10 * GB)).toBe(false);
    expect(upload("ip", 4 * GB)).toBe(true);
  });

  it("doesn't charge for a request that fails somewhere later", () => {
    // A sender whose ad won't load must not burn their own hour on attempts
    // that never produced an upload URL.
    for (let i = 0; i < 10; i++) expect(wouldExceedByteBudget("ip", 6 * GB, 20 * GB, 60_000)).toBe(false);
    expect(upload("ip", 18 * GB)).toBe(true);
  });

  it("refuses a single request bigger than the whole budget", () => {
    expect(upload("ip", 50 * GB)).toBe(false);
  });

  it("keeps one caller's budget away from another's", () => {
    expect(upload("a", 20 * GB)).toBe(true);
    expect(upload("b", 20 * GB)).toBe(true);
  });

  it("starts fresh once the window has passed", () => {
    expect(upload("ip", 20 * GB, 20 * GB, 1)).toBe(true);
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 1000);
    expect(upload("ip", 20 * GB, 20 * GB, 1)).toBe(true);
    vi.useRealTimers();
  });
});
