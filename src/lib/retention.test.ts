import { describe, expect, it } from "vitest";
import {
  clampRetentionHours,
  MAX_LINK_BYTES,
  maxRetentionHoursFor,
  retentionChoicesFor,
  retentionLabel,
} from "./retention";
import { storageCostUsd } from "./ads";

const GB = 1024 ** 3;

describe("the retention ladder", () => {
  it("gives a small file the full week", () => {
    expect(maxRetentionHoursFor(500 * 1024 * 1024)).toBe(168);
    expect(maxRetentionHoursFor(2 * GB)).toBe(168);
  });

  it("shortens the window as the file grows", () => {
    expect(maxRetentionHoursFor(2 * GB + 1)).toBe(24);
    expect(maxRetentionHoursFor(10 * GB)).toBe(24);
    expect(maxRetentionHoursFor(10 * GB + 1)).toBe(6);
    expect(maxRetentionHoursFor(50 * GB)).toBe(6);
  });

  it("refuses what's past the top of the ladder", () => {
    expect(maxRetentionHoursFor(MAX_LINK_BYTES + 1)).toBeNull();
    expect(maxRetentionHoursFor(0)).toBeNull();
  });

  it("keeps every tier within a rounding error of the same cost", () => {
    // The property that makes the ladder fair: no tier is dramatically more
    // expensive to serve than another, so each costs about one ad.
    const perTier = [
      storageCostUsd(2 * GB, 168),
      storageCostUsd(10 * GB, 24),
      storageCostUsd(50 * GB, 6),
    ];
    expect(Math.max(...perTier) / Math.min(...perTier)).toBeLessThan(1.5);
  });

  it("lets a deployment lower the ceiling without touching the tiers", () => {
    expect(maxRetentionHoursFor(5 * GB, 2 * GB)).toBeNull();
    expect(maxRetentionHoursFor(GB, 2 * GB)).toBe(168);
  });
});

describe("what the sender is offered", () => {
  it("offers the full menu for a small file", () => {
    expect(retentionChoicesFor(GB)).toEqual([1, 24, 72, 168]);
  });

  it("drops the windows a big file can't have, but keeps its own maximum", () => {
    expect(retentionChoicesFor(40 * GB)).toEqual([1, 6]);
    expect(retentionChoicesFor(5 * GB)).toEqual([1, 24]);
  });

  it("offers nothing for a file past the ceiling", () => {
    expect(retentionChoicesFor(MAX_LINK_BYTES + 1)).toEqual([]);
  });

  it("writes windows the way a person would say them", () => {
    expect(retentionLabel(1)).toBe("1 hour");
    expect(retentionLabel(6)).toBe("6 hours");
    expect(retentionLabel(24)).toBe("1 day");
    expect(retentionLabel(168)).toBe("7 days");
  });
});

describe("clamping a requested window", () => {
  it("grants what's asked for when the file is allowed it", () => {
    expect(clampRetentionHours(168, GB)).toBe(168);
  });

  it("shortens rather than refuses when it isn't", () => {
    expect(clampRetentionHours(168, 40 * GB)).toBe(6);
  });

  it("never goes below an hour, whatever is asked", () => {
    expect(clampRetentionHours(0, GB)).toBe(1);
    expect(clampRetentionHours(-50, GB)).toBe(1);
  });

  it("refuses outright only when the file itself is too big", () => {
    expect(clampRetentionHours(1, MAX_LINK_BYTES + 1)).toBeNull();
  });
});
