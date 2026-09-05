import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { __resetAdGate, completeAdSession, consumeAdReceipt, startAdSession } from "./adGate";

const GB = 1024 ** 3;

/** Walks a session all the way to a spendable receipt. */
function watchThrough(purpose: Parameters<typeof startAdSession>[0], bytes = 0, hours = 24) {
  const { sessionId, plan } = startAdSession(purpose, bytes, hours);
  vi.advanceTimersByTime(plan.totalMs);
  const result = completeAdSession(sessionId);
  if (!result.ok) throw new Error(result.error);
  return result.receipt;
}

describe("ad gate, with a network configured", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    process.env.NEXT_PUBLIC_AD_HOUSE = "1";
    __resetAdGate();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete process.env.NEXT_PUBLIC_AD_HOUSE;
  });

  it("refuses a receipt before the clock has run", () => {
    const { sessionId } = startAdSession("reveal-code");
    const result = completeAdSession(sessionId);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("issues one once it has", () => {
    expect(watchThrough("reveal-code")).toMatch(/^[a-f0-9]{48}$/);
  });

  it("won't hand out a second receipt for the same watch", () => {
    const { sessionId, plan } = startAdSession("reveal-code");
    vi.advanceTimersByTime(plan.totalMs);
    expect(completeAdSession(sessionId).ok).toBe(true);
    expect(completeAdSession(sessionId).ok).toBe(false);
  });

  it("spends a receipt exactly once", () => {
    const receipt = watchThrough("link-upload", GB, 24);
    expect(consumeAdReceipt(receipt, { purpose: "link-upload", bytes: GB, hours: 24 })).toBe(true);
    expect(consumeAdReceipt(receipt, { purpose: "link-upload", bytes: GB, hours: 24 })).toBe(false);
  });

  it("rejects a receipt earned for a different action", () => {
    const receipt = watchThrough("reveal-code");
    expect(consumeAdReceipt(receipt, { purpose: "link-upload", bytes: GB, hours: 24 })).toBe(false);
  });

  it("rejects a cheap receipt presented for an expensive upload", () => {
    // The obvious way to cheat the ladder: watch the ads for a small file,
    // then upload something that costs 50x as much to hold.
    const receipt = watchThrough("link-upload", 10 * 1024 * 1024, 1);
    expect(consumeAdReceipt(receipt, { purpose: "link-upload", bytes: 200 * GB, hours: 168 })).toBe(false);
  });

  it("accepts a receipt spent on something cheaper than it paid for", () => {
    const receipt = watchThrough("link-upload", 100 * GB, 168);
    expect(consumeAdReceipt(receipt, { purpose: "link-upload", bytes: GB, hours: 1 })).toBe(true);
  });

  it("tolerates the zip container a multi-file upload grows on the way out", () => {
    // Priced on the sum of the files; uploaded as a zip that is a little bigger.
    const files = 512 * 1024 * 1024;
    const receipt = watchThrough("link-upload", files, 168);
    expect(consumeAdReceipt(receipt, { purpose: "link-upload", bytes: files + 4096, hours: 168 })).toBe(true);
  });

  it("rejects junk", () => {
    expect(consumeAdReceipt(undefined, { purpose: "reveal-code" })).toBe(false);
    expect(consumeAdReceipt("not-a-receipt", { purpose: "reveal-code" })).toBe(false);
    expect(consumeAdReceipt("a".repeat(48), { purpose: "reveal-code" })).toBe(false);
  });
});

describe("ad gate, with no network configured", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_AD_HOUSE;
    delete process.env.NEXT_PUBLIC_AD_CLIENT;
    __resetAdGate();
  });

  it("prices every action at nothing, so the flow is unchanged", () => {
    expect(startAdSession("link-upload", 100 * GB, 168).plan.totalMs).toBe(0);
  });

  it("waves every request through rather than blocking uploads", () => {
    expect(consumeAdReceipt(undefined, { purpose: "link-upload", bytes: GB, hours: 24 })).toBe(true);
  });
});
