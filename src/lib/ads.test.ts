import { describe, expect, it } from "vitest";
import { AD_FORMATS, GATE_SECONDS, planFor } from "./ads";

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
