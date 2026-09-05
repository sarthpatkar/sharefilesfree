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

export interface AdPlan {
  purpose: AdPurpose;
  seconds: number;
  totalMs: number;
}

export interface AdPlanInput {
  /** For "reveal-code": how long the sender asked the code to stay valid. */
  roomMinutes?: number;
}

export function planFor(purpose: AdPurpose, input: AdPlanInput = {}): AdPlan {
  const seconds =
    purpose === "reveal-code" && input.roomMinutes
      ? (ROOM_DURATION_ADS[input.roomMinutes] ?? GATE_SECONDS)
      : GATE_SECONDS;
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
