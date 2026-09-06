import { describe, expect, it } from "vitest";
import {
  AD_FORMATS,
  DEFAULT_ROOM_DURATION,
  GATE_SECONDS,
  planFor,
  ROOM_DURATION_ADS,
  ROOM_DURATION_CHOICES,
  secondsForTransferSize,
  TRANSFER_SIZE_ADS,
} from "./ads";

describe("planFor", () => {
  it("charges both gated moments the same short ad", () => {
    for (const purpose of ["reveal-code", "receive-connect"] as const) {
      const plan = planFor(purpose);
      expect(plan.seconds).toBe(GATE_SECONDS);
      expect(plan.totalMs).toBe(GATE_SECONDS * 1000);
    }
  });

  it("keeps the gate short enough to fill a wait rather than create one", () => {
    // Both gates sit in front of a connection that takes a second or two. The
    // fifteen-second rewarded format belonged to uploads, which are gone.
    expect(GATE_SECONDS).toBeLessThanOrEqual(5);
  });
});

describe("banner formats", () => {
  it("gives every format a height to reserve before anything loads", () => {
    for (const spec of Object.values(AD_FORMATS)) {
      expect(spec.minHeight).toBeGreaterThan(0);
      expect(spec.maxWidth).toBeGreaterThan(0);
    }
  });
});

describe("buying a longer-lived code", () => {
  it("charges the baseline for the default duration", () => {
    expect(planFor("reveal-code", { roomMinutes: DEFAULT_ROOM_DURATION }).seconds).toBe(GATE_SECONDS);
  });

  it("never charges less for a longer code than a shorter one", () => {
    const seconds = ROOM_DURATION_CHOICES.map((m) => planFor("reveal-code", { roomMinutes: m }).seconds);
    expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
    expect(seconds[seconds.length - 1]).toBeGreaterThan(seconds[0]);
  });

  it("prices every duration the sender can actually pick", () => {
    for (const m of ROOM_DURATION_CHOICES) expect(ROOM_DURATION_ADS[m]).toBeGreaterThan(0);
  });

  it("falls back to the baseline for a duration nobody offers", () => {
    // The server snaps an unknown request to the default, so the gate must not
    // charge more than the baseline for something that will be ignored anyway.
    expect(planFor("reveal-code", { roomMinutes: 9999 }).seconds).toBe(GATE_SECONDS);
  });

  it("leaves the receiver's gate alone whatever the sender chose", () => {
    expect(planFor("receive-connect", { roomMinutes: 120 }).seconds).toBe(GATE_SECONDS);
  });
});

const MB = 1024 * 1024;
const GB = 1024 * MB;

describe("a bigger transfer earns a longer ad", () => {
  // The economic point of this ladder: revenue scales with page views, but the
  // cost of the service scales with relayed bytes. Without this they are
  // unconnected, and a single very large relayed transfer earns nothing while
  // costing real money.

  it("charges the ordinary transfer exactly what it charges today", () => {
    for (const bytes of [0, 1, 5 * MB, 50 * MB, 100 * MB]) {
      expect(planFor("reveal-code", { totalBytes: bytes }).seconds).toBe(GATE_SECONDS);
    }
  });

  it("never charges less for a bigger transfer than a smaller one", () => {
    const sizes = [10 * MB, 500 * MB, 5 * GB, 50 * GB];
    const seconds = sizes.map((b) => secondsForTransferSize(b));
    expect(seconds).toEqual([...seconds].sort((a, b) => a - b));
    expect(seconds[seconds.length - 1]).toBeGreaterThan(seconds[0]);
  });

  it("keeps a ceiling, so no transfer is ever an unskippable toll", () => {
    // Never more than the most expensive thing already on offer — the 2h room.
    const ceiling = Math.max(...Object.values(ROOM_DURATION_ADS));
    for (const band of TRANSFER_SIZE_ADS) expect(band.seconds).toBeLessThanOrEqual(ceiling);
    // Including for absurd inputs.
    expect(secondsForTransferSize(Number.MAX_SAFE_INTEGER)).toBeLessThanOrEqual(ceiling);
  });

  it("takes the larger of size and duration rather than stacking them", () => {
    // A 2h room (20s) and a 10GB file (15s) must not become 35s. An ad long
    // enough to abandon earns nothing.
    const plan = planFor("reveal-code", { roomMinutes: 120, totalBytes: 10 * GB });
    expect(plan.seconds).toBe(Math.max(ROOM_DURATION_ADS[120], secondsForTransferSize(10 * GB)));
    expect(plan.seconds).toBeLessThanOrEqual(Math.max(...Object.values(ROOM_DURATION_ADS)));
  });

  it("treats a missing or nonsensical size as the baseline", () => {
    expect(planFor("reveal-code", {}).seconds).toBe(GATE_SECONDS);
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(secondsForTransferSize(bad)).toBe(GATE_SECONDS);
    }
  });

  it("still leaves the receiver's gate alone — they did not choose the file", () => {
    expect(planFor("receive-connect", { totalBytes: 50 * GB }).seconds).toBe(GATE_SECONDS);
  });
});
