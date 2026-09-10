// Ad policy — the single place that decides WHERE ads appear and how long they
// run. Deliberately pure and isomorphic (no env reads, no DOM, no network) so
// every screen renders from the same source.
//
// The product rule this encodes, in one line: ads gate the two moments in a
// transfer where the user is already waiting, and NEVER the tools. Tool pages
// carry banners only — gating a tool would contradict the site's own promise
// ("no queue, no watermark, no daily limit"), and the tools are the
// highest-volume, safest inventory precisely because they're frictionless.

/**
 * Every action an ad can gate. Anything not on this list is not gateable.
 *
 * There is deliberately no entry for downloading or uploading. The service
 * stores nothing: there is no upload, and the only pages showing content we
 * did not write are gone with it.
 */
export type AdPurpose =
  | "reveal-code" // sender clicks "get a code" -> short ad -> code appears
  | "reveal-group-code" // same, for a share going to several devices at once
  | "receive-connect"; // receiver clicks connect -> short ad -> transfer starts

/**
 * The baseline gate.
 *
 * Five seconds, and the reason it's short is the rule this file answers to: AN
 * AD MUST NEVER BE LONGER THAN THE WAIT IT PLAYS OVER. Both gated moments sit
 * in front of a connection that takes a second or two, so five is the most that
 * can be filled rather than manufactured.
 */
export const GATE_SECONDS = 5;

/**
 * What a longer-lived code costs, in seconds of ad.
 *
 * This is the one place the rule above bends, and deliberately: a two-hour code
 * is not a wait being filled, it is something extra the sender chose to ask
 * for. That makes it a rewarded exchange rather than a toll — the default
 * always costs the baseline five seconds, and nobody is ever made to watch
 * longer for the thing they came here to do.
 *
 * Being honest about what is being paid for: a long room costs us almost
 * nothing to hold. This is not cost recovery, it is the site's only source of
 * income attached to the one feature people will want more of.
 */
export const ROOM_DURATION_ADS: Record<number, number> = {
  10: GATE_SECONDS,
  30: 10,
  60: 15,
  120: 20,
};

/** The durations a sender may choose, shortest first. Must match the server's list. */
export const ROOM_DURATION_CHOICES = [10, 30, 60, 120] as const;
export const DEFAULT_ROOM_DURATION = 10;

/**
 * How many devices one group code may serve. Must match clampDeviceSlots in
 * /server/index.js — the server is what actually enforces it, this is what the
 * screen offers.
 */
export const MAX_DEVICES = 20;
export const DEVICE_CHOICES = [2, 3, 5, 10, 20] as const;
export const DEFAULT_DEVICES = 2;

export interface AdPlan {
  purpose: AdPurpose;
  seconds: number;
  totalMs: number;
}

/**
 * What a large transfer costs, in seconds of ad.
 *
 * This is the one place the site's economics are actually balanced, so the
 * reasoning matters more than the numbers.
 *
 * Ad revenue scales with PAGE VIEWS. The cost of running this service scales
 * with RELAYED BYTES — when two peers can't reach each other directly, their
 * file goes through Cloudflare's TURN relay and we pay per gigabyte for it, and
 * that single line is the overwhelming majority of what the service costs. Those
 * two quantities are otherwise completely unconnected: somebody can send fifty
 * gigabytes through the relay and generate exactly one page view's worth of
 * revenue while doing it. At any real scale that gap is the thing that turns a
 * free service into an unaffordable one.
 *
 * Scaling the ad with the size of the transfer connects them. It is also the
 * only lever that does so without breaking the promise the whole product rests
 * on — there is no size cap here and there is not going to be one. "No limits"
 * is the moat; a big transfer is not refused, it is simply worth more.
 *
 * Two guardrails keep this from becoming a toll:
 *
 *   - The ceiling is the same twenty seconds the longest room already costs. We
 *     never charge more for a big file than for the most expensive thing already
 *     on offer, however large it gets.
 *   - The overwhelming majority of real transfers — photos, documents, a video
 *     off a phone — sit in the first band and are charged exactly what they are
 *     charged today. Nothing gets worse for the common case.
 */
export const TRANSFER_SIZE_ADS: ReadonlyArray<{ upToBytes: number; seconds: number }> = [
  { upToBytes: 100 * 1024 * 1024, seconds: GATE_SECONDS }, // <= 100MB: the common case, unchanged
  { upToBytes: 1024 * 1024 * 1024, seconds: 10 }, // <= 1GB
  { upToBytes: 10 * 1024 * 1024 * 1024, seconds: 15 }, // <= 10GB
  { upToBytes: Number.POSITIVE_INFINITY, seconds: 20 }, // beyond that, the ceiling
];

/** Seconds of ad earned by a transfer of this total size. */
export function secondsForTransferSize(totalBytes: number): number {
  if (!Number.isFinite(totalBytes) || totalBytes <= 0) return GATE_SECONDS;
  return TRANSFER_SIZE_ADS.find((band) => totalBytes <= band.upToBytes)?.seconds ?? GATE_SECONDS;
}

export interface AdPlanInput {
  /** For "reveal-code": how long the sender asked the code to stay valid. */
  roomMinutes?: number;
  /** For "reveal-code": total bytes about to be sent, across all selected files. */
  totalBytes?: number;
  /**
   * For "reveal-group-code": how many devices the code will serve.
   *
   * This multiplies the size band rather than earning a band of its own, and
   * that is the whole point. What costs money here is RELAYED BYTES — the
   * argument is written out above and metrics.ts exists to measure it — and
   * sending the same file to five devices is five times the bytes. It is the
   * same quantity the size bands already charge for, so it belongs in the same
   * multiplication and not in a second table that would have to be kept
   * consistent with this one.
   *
   * What falls out of that is the answer to "what counts as a normal share":
   * anything where devices x size stays under 100MB is charged the baseline
   * five seconds, exactly as it is today. A handout going to twenty phones is
   * 20MB and costs nothing extra; a 2GB video going to twenty devices is 40GB
   * of real bandwidth and hits the ceiling. Nobody pays for a big number of
   * devices, they pay for a big number of bytes.
   */
  deviceCount?: number;
}

export function planFor(purpose: AdPurpose, input: AdPlanInput = {}): AdPlan {
  if (purpose !== "reveal-code" && purpose !== "reveal-group-code") {
    return { purpose, seconds: GATE_SECONDS, totalMs: GATE_SECONDS * 1000 };
  }

  const devices = Math.max(1, Math.floor(input.deviceCount ?? 1));
  const effectiveBytes = (input.totalBytes ?? 0) * devices;

  const forDuration = input.roomMinutes ? (ROOM_DURATION_ADS[input.roomMinutes] ?? GATE_SECONDS) : GATE_SECONDS;
  const forSize = effectiveBytes ? secondsForTransferSize(effectiveBytes) : GATE_SECONDS;

  // The larger of the two, never the sum. A sender who wants a two-hour code AND
  // is sending ten gigabytes is asking for two expensive things at once, but
  // charging for both would stack into something nobody would sit through — and
  // an ad long enough to abandon earns nothing at all.
  const seconds = Math.max(forDuration, forSize);
  return { purpose, seconds, totalMs: seconds * 1000 };
}

/**
 * Fixed pixel heights per banner format, used to reserve space BEFORE any ad
 * script runs. This is the whole reason AdSlot has a format at all: an ad that
 * arrives into unreserved space shifts the page, which moves Core Web Vitals,
 * which moves the search ranking that brings the tool traffic the ads are being
 * sold against. Reserving space is not politeness, it's the business.
 */
export const AD_FORMATS = {
  /** Wide unit in the body of a page, between sections. */
  leaderboard: { minHeight: 90, maxWidth: 970, label: "leaderboard" },
  /** Squarer unit that sits inside a column, e.g. beside a panel. */
  rectangle: { minHeight: 250, maxWidth: 336, label: "rectangle" },
  /** Bottom-of-page unit. In normal flow, never fixed/overlaying — an oversized
   *  sticky ad is a Coalition for Better Ads violation on mobile web. */
  anchor: { minHeight: 100, maxWidth: 970, label: "anchor" },
} as const;

export type AdFormat = keyof typeof AD_FORMATS;
