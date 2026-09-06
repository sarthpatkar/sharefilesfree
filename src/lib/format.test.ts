import { describe, expect, it } from "vitest";
import { formatBytes, formatDuration, formatRate } from "./format";

describe("formatBytes", () => {
  it("handles zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("formats plain bytes without a decimal", () => {
    expect(formatBytes(500)).toBe("500 B");
  });

  it("formats kilobytes with one decimal", () => {
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats megabytes and gigabytes", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe("2.5 GB");
  });

  it("never exceeds the largest known unit", () => {
    // A huge value should clamp to TB rather than throwing or producing "undefined".
    expect(formatBytes(1024 ** 5)).toMatch(/TB$/);
  });
});

describe("formatDuration", () => {
  it("shows whole seconds under a minute", () => {
    expect(formatDuration(47_000)).toBe("47s");
    expect(formatDuration(46_830)).toBe("47s");
  });

  it("shows minutes and seconds", () => {
    expect(formatDuration(134_000)).toBe("2m 14s");
    expect(formatDuration(120_000)).toBe("2m");
  });

  it("shows hours for a long transfer", () => {
    expect(formatDuration(3_780_000)).toBe("1h 3m");
    expect(formatDuration(3_600_000)).toBe("1h");
  });

  it("refuses to invent a number it doesn't have", () => {
    expect(formatDuration(Number.NaN)).toBe("—");
    expect(formatDuration(-1)).toBe("—");
  });
});

describe("formatRate", () => {
  it("reports megabits, the unit people compare against their line", () => {
    // 10MB in 8s = 10 Mbps. Reporting 1.25 MB/s would invite the wrong comparison.
    expect(formatRate(10 * 1000 * 1000, 8000)).toBe("10.0 Mbps");
  });

  it("drops to kilobits on a slow link rather than showing 0.0", () => {
    expect(formatRate(50_000, 1000)).toBe("400 Kbps");
  });

  it("refuses to divide by zero or by nothing", () => {
    expect(formatRate(0, 1000)).toBe("—");
    expect(formatRate(1000, 0)).toBe("—");
  });
});
