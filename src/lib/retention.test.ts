import { describe, expect, it } from "vitest";
import {
  ABSOLUTE_MAX_HOURS,
  clampRetentionHours,
  MAX_LINK_BYTES,
  forcesSingleDownload,
  maxPurchasableHours,
  maxRetentionHoursFor,
  SINGLE_DOWNLOAD_ABOVE_BYTES,
  retentionChoicesFor,
  retentionLabel,
} from "./retention";
import { MAX_RECOVERABLE_USD, planFor, storageCostUsd } from "./ads";

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

describe("buying a longer window with ads", () => {
  it("lets a big file reach further than the window it comes with", () => {
    const base = maxRetentionHoursFor(50 * GB)!;
    const bought = maxPurchasableHours(50 * GB)!;
    expect(bought).toBeGreaterThan(base);
  });

  it("never lets anyone buy more storage than the ads pay for", () => {
    // The property that makes this safe: whatever the sender is allowed to ask
    // for, the ads at that price cover its cost.
    for (const bytes of [GB, 5 * GB, 10 * GB, 30 * GB, MAX_LINK_BYTES]) {
      const hours = maxPurchasableHours(bytes)!;
      expect(storageCostUsd(bytes, hours)).toBeLessThanOrEqual(MAX_RECOVERABLE_USD + 1e-9);
    }
  });

  it("still stops at a week, however cheap the file is to hold", () => {
    expect(maxPurchasableHours(1024)).toBe(ABSOLUTE_MAX_HOURS);
    expect(maxPurchasableHours(GB)).toBe(ABSOLUTE_MAX_HOURS);
  });

  it("offers nothing extra when there are no ads to buy it with", () => {
    expect(retentionChoicesFor(50 * GB, { adsEnabled: false })).toEqual([1, 6]);
    expect(retentionChoicesFor(50 * GB, { adsEnabled: true })).toEqual([1, 6, 24]);
  });

  it("prices the longer window as more ads, and says so consistently", () => {
    const choices = retentionChoicesFor(50 * GB, { adsEnabled: true });
    const slots = choices.map((h) => planFor("link-upload", { bytes: 50 * GB, hours: h }).slots);
    // Monotonic: a longer window never costs fewer ads than a shorter one.
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
    // And the top of the menu genuinely costs more than the base window.
    expect(slots[slots.length - 1]).toBeGreaterThan(slots[0]);
  });

  it("widens the clamp only when ads are on", () => {
    expect(clampRetentionHours(24, 50 * GB, { adsEnabled: false })).toBe(6);
    expect(clampRetentionHours(24, 50 * GB, { adsEnabled: true })).toBe(24);
  });

  it("still refuses a window past what even the maximum ads would cover", () => {
    expect(clampRetentionHours(168, 50 * GB, { adsEnabled: true })).toBeLessThan(168);
  });
});

describe("one-time links for big files", () => {
  it("leaves ordinary shares alone", () => {
    expect(forcesSingleDownload(50 * 1024 * 1024)).toBe(false);
    expect(forcesSingleDownload(SINGLE_DOWNLOAD_ABOVE_BYTES)).toBe(false);
  });

  it("forces it on everything the ladder calls large", () => {
    // The control that makes a 50GB ceiling survivable: distribution needs one
    // file and many downloaders, and a link that dies on first use has none.
    expect(forcesSingleDownload(SINGLE_DOWNLOAD_ABOVE_BYTES + 1)).toBe(true);
    expect(forcesSingleDownload(MAX_LINK_BYTES)).toBe(true);
  });

  it("applies to every file whose window is shorter than the maximum", () => {
    // The two thresholds are set independently, so this checks they line up:
    // anything held on a shortened window is also a one-time link.
    for (const bytes of [3 * GB, 10 * GB, 30 * GB, MAX_LINK_BYTES]) {
      if (maxRetentionHoursFor(bytes)! < 168) expect(forcesSingleDownload(bytes)).toBe(true);
    }
  });
});
