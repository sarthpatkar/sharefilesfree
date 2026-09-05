// Ad policy — the single place that decides WHERE ads appear and HOW MANY a
// given action is worth. Deliberately pure and isomorphic (no env reads, no
// DOM, no network): the server uses it to decide what to enforce, the client
// uses it to decide what to render, and they cannot drift apart.
//
// The product rule this encodes, in one line: ads gate the transfer flow and
// the storage path, and NEVER the tools. Tool pages carry banners only —
// gating a tool would contradict the site's own promise ("no queue, no
// watermark, no daily limit") and the tools are the highest-volume, safest ad
// inventory precisely because they're frictionless.

/**
 * Every action an ad can gate. Anything not on this list is not gateable.
 *
 * Downloading a shared link is deliberately ABSENT, and should stay absent.
 * The download page is the only page on the site showing content we did not
 * write and cannot vet, and running ads beside material that turns out to be
 * infringing is a well-worn way to lose an ad account — which would take the
 * tools' revenue with it. Small gain, total loss. It also spares the person
 * downloading, who is someone else's guest and is meeting the site for the
 * first time; the sender already paid for that transfer with an ad on upload.
 */
export type AdPurpose =
  | "reveal-code" // sender clicks "get a code" -> short ad -> code appears
  | "receive-connect" // receiver clicks connect -> short ad -> transfer starts
  | "link-upload"; // uploading to R2 — the only path that costs real money

/**
 * Storage on R2, per GB per month. The only per-byte cost in the product —
 * the P2P path never touches it, which is why the P2P gates below are flat
 * (revenue) while the link gate scales (cost recovery).
 */
export const R2_USD_PER_GB_MONTH = 0.015;

/**
 * What one completed rewarded view is assumed to bring in. This is the number
 * to tune once real eCPM data exists — everything else follows from it. Set
 * conservatively: rewarded video runs well above this in the US and well below
 * it on India-weighted traffic, and being wrong in the cheap direction just
 * means showing one ad where two were affordable.
 */
export const USD_RECOVERED_PER_AD = 0.01;

/** Nobody is ever asked to sit through more than this, whatever the arithmetic says. */
export const MAX_SLOTS_PER_ACTION = 4;

/**
 * The most a single action can ever recover, and therefore the most storage it
 * can ever justify. This is the number that stops the slot cap from becoming a
 * leak: without it, a request expensive enough to need ten ads would be charged
 * four and we'd quietly eat the other six.
 */
export const MAX_RECOVERABLE_USD = MAX_SLOTS_PER_ACTION * USD_RECOVERED_PER_AD;

/** Hours in a month, for prorating the per-month storage price. */
const HOURS_PER_MONTH = 730;

const BYTES_PER_GB = 1024 ** 3;

/** What it costs us to hold `bytes` for `hours` on R2. */
export function storageCostUsd(bytes: number, hours: number): number {
  if (!(bytes > 0) || !(hours > 0)) return 0;
  return (bytes / BYTES_PER_GB) * (hours / HOURS_PER_MONTH) * R2_USD_PER_GB_MONTH;
}

export interface AdPlan {
  purpose: AdPurpose;
  /** How many ads this action is worth. 0 means "don't gate this at all". */
  slots: number;
  /** Length of one ad. Short and static on the free path, rewarded-video length on the paid one. */
  secondsPerSlot: number;
  /** Total time the server will insist has elapsed before it issues a receipt. */
  totalMs: number;
}

export interface AdPlanInput {
  /** Size of the file being uploaded — only meaningful for "link-upload". */
  bytes?: number;
  /** How long the link is asked to stay alive — only meaningful for "link-upload". */
  hours?: number;
}

/**
 * How long a single ad runs, per purpose. The transfer flow gets a short
 * static/display unit because it interrupts something the user is in the
 * middle of; the storage path gets a full rewarded-video length because it
 * plays inside an upload that was going to take minutes anyway.
 */
const SECONDS_PER_SLOT: Record<AdPurpose, number> = {
  "reveal-code": 5,
  "receive-connect": 5,
  "link-upload": 15, // the floor for a big upload; small ones are shortened below
};

/**
 * Below this, an upload is not gated at all.
 *
 * The governing rule for the whole file: AN AD MUST NEVER BE LONGER THAN THE
 * UPLOAD IT PLAYS OVER. Fifteen seconds during a 2GB upload is free, because
 * the upload takes minutes and the ad hides inside it. The same fifteen seconds
 * on a 5MB file turns a three-second action into a fifteen-second one, which is
 * manufacturing friction rather than filling it — the opposite of the point.
 *
 * Nothing is lost by letting these through: a 50MB file kept a full week costs
 * $0.00017 to store, so a single short ad already covers a hundred of them, and
 * the sender's own transfer screen carries a slot regardless.
 */
export const UNGATED_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Up to here an upload is quick enough that only the short ad fits over it. */
const SHORT_AD_UPLOAD_BYTES = 50 * 1024 * 1024;

export function planFor(purpose: AdPurpose, input: AdPlanInput = {}): AdPlan {
  let secondsPerSlot = SECONDS_PER_SLOT[purpose];
  let slots = 1;

  if (purpose === "link-upload") {
    const bytes = input.bytes ?? 0;

    // Too quick to hide an ad behind, and too cheap to be worth one.
    if (bytes < UNGATED_UPLOAD_BYTES) {
      return { purpose, slots: 0, secondsPerSlot: 0, totalMs: 0 };
    }

    // The one action whose cost to us varies, so the only one whose ad load
    // varies with it. Note this is driven by bytes x time, not bytes alone:
    // a 50GB file kept for six hours is cheaper than a 2GB file kept a week,
    // and the ladder should say so.
    const cost = storageCostUsd(bytes, input.hours ?? 24);
    slots = Math.min(MAX_SLOTS_PER_ACTION, Math.max(1, Math.ceil(cost / USD_RECOVERED_PER_AD)));

    // A file small enough to upload in seconds gets the short ad. It can never
    // need more than one: everything under this size costs a fraction of a cent
    // to hold even for the maximum week, so one short ad covers it many times.
    if (bytes < SHORT_AD_UPLOAD_BYTES) secondsPerSlot = SECONDS_PER_SLOT["reveal-code"];
  }

  return { purpose, slots, secondsPerSlot, totalMs: slots * secondsPerSlot * 1000 };
}

/**
 * Fixed pixel heights per banner format, used to reserve space BEFORE any ad
 * script runs. This is the whole reason AdSlot has a format at all: an ad that
 * arrives into unreserved space shifts the page, which moves Core Web Vitals,
 * which moves the search ranking that brings the tool traffic that the ads are
 * being sold against. Reserving space is not politeness, it's the business.
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
