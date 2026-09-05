import { describe, expect, it } from "vitest";
import {
  AD_FORMATS,
  DEFAULT_ROOM_DURATION,
  GATE_SECONDS,
  planFor,
  ROOM_DURATION_ADS,
  ROOM_DURATION_CHOICES,
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
