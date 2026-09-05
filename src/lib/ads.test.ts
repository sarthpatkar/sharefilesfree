import { describe, expect, it } from "vitest";
import { MAX_SLOTS_PER_ACTION, planFor, storageCostUsd, UNGATED_UPLOAD_BYTES } from "./ads";

const GB = 1024 ** 3;

describe("storageCostUsd", () => {
  it("is zero for a file with no size or no lifetime", () => {
    expect(storageCostUsd(0, 24)).toBe(0);
    expect(storageCostUsd(GB, 0)).toBe(0);
  });

  it("scales with bytes AND with time, not either alone", () => {
    const base = storageCostUsd(GB, 24);
    expect(storageCostUsd(2 * GB, 24)).toBeCloseTo(base * 2, 10);
    expect(storageCostUsd(GB, 48)).toBeCloseTo(base * 2, 10);
  });

  it("makes a big short-lived file cheaper than a small long-lived one", () => {
    // The whole reason ads buy retention rather than size.
    expect(storageCostUsd(50 * GB, 6)).toBeLessThan(storageCostUsd(2 * GB, 168));
  });
});

describe("planFor", () => {
  it("charges one short ad for the free P2P actions, whatever the file", () => {
    for (const purpose of ["reveal-code", "receive-connect"] as const) {
      const plan = planFor(purpose, { bytes: 500 * GB, hours: 168 });
      expect(plan.slots).toBe(1);
      expect(plan.secondsPerSlot).toBe(5);
      expect(plan.totalMs).toBe(5000);
    }
  });

  it("asks a 2GB week-long link for a single ad", () => {
    expect(planFor("link-upload", { bytes: 2 * GB, hours: 168 }).slots).toBe(1);
  });

  it("doesn't gate an upload that's over before an ad could play", () => {
    // The rule the whole ladder answers to: an ad must never be longer than the
    // upload it plays over. A few megabytes are gone in seconds and cost a
    // fraction of a cent to keep, so a fifteen-second ad would BE the wait.
    expect(planFor("link-upload", { bytes: 1, hours: 168 }).slots).toBe(0);
    expect(planFor("link-upload", { bytes: UNGATED_UPLOAD_BYTES - 1, hours: 168 }).totalMs).toBe(0);
  });

  it("shortens the ad for a file that uploads in seconds", () => {
    const small = planFor("link-upload", { bytes: 20 * 1024 * 1024, hours: 168 });
    expect(small.slots).toBe(1);
    expect(small.secondsPerSlot).toBe(5);
  });

  it("uses the full rewarded length once the upload is long enough to hide it", () => {
    const big = planFor("link-upload", { bytes: 500 * 1024 * 1024, hours: 168 });
    expect(big.secondsPerSlot).toBe(15);
  });

  it("never asks a small file for more than one short ad, whatever the window", () => {
    // Everything below the short-ad threshold costs a fraction of a cent even
    // at the maximum week, so one ad always covers it many times over.
    for (const bytes of [6 * 1024 * 1024, 20 * 1024 * 1024, 49 * 1024 * 1024]) {
      expect(planFor("link-upload", { bytes, hours: 168 }).slots).toBe(1);
    }
  });

  it("asks for more as the file gets more expensive to hold", () => {
    const cheap = planFor("link-upload", { bytes: 2 * GB, hours: 24 }).slots;
    const dear = planFor("link-upload", { bytes: 40 * GB, hours: 168 }).slots;
    expect(dear).toBeGreaterThan(cheap);
  });

  it("caps the ladder however absurd the request", () => {
    expect(planFor("link-upload", { bytes: 10_000 * GB, hours: 168 }).slots).toBe(MAX_SLOTS_PER_ACTION);
  });

  it("shortening retention lowers the ad load for the same file", () => {
    const week = planFor("link-upload", { bytes: 50 * GB, hours: 168 }).slots;
    const hours = planFor("link-upload", { bytes: 50 * GB, hours: 6 }).slots;
    expect(hours).toBeLessThan(week);
  });
});
