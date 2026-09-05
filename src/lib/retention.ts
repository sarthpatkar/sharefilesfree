// How long a shared link is allowed to live, as a function of how big it is —
// and how much longer the sender can have by watching more ads.
//
// The insight this file encodes: R2 bills bytes x TIME, so size on its own is
// the wrong thing to ration. A 50GB file kept six hours costs less than a 2GB
// file kept a week. Capping size alone means either a small ceiling everyone
// resents, or a big one that quietly costs a fortune on the tail.
//
// So the ceiling on size is generous and the retention window narrows as the
// file grows, which is also what people actually want: nobody sending 50GB
// expects it to sit around for a week — they want it collected now.
//
// Each tier below lands within a fraction of a cent of the others, which is
// the property worth preserving if these numbers are ever changed: one tier
// should not be dramatically more expensive to serve than another.
//
//   2GB for 7 days  = $0.0069     10GB for 24h = $0.0049     50GB for 6h = $0.0062
//
// The tiers below are the window a file gets for the ONE ad every link upload
// costs. Beyond that the sender can buy time with attention — a longer window
// for a big file is simply a few more ads, priced from what those extra hours
// actually cost. That's the whole loop: ads buy time, because time is what we
// are billed for.
//
// Pure and isomorphic on purpose: the upload API enforces this ladder and the
// send UI renders its options from the same source, so the two cannot drift.

import { MAX_RECOVERABLE_USD, storageCostUsd } from "./ads";

const GB = 1024 ** 3;

export interface RetentionTier {
  /** Files up to this size fall in this tier. */
  maxBytes: number;
  /** ...and may be kept for at most this long. */
  maxHours: number;
}

/** Ordered smallest-first. The last tier's maxBytes is the hard size ceiling. */
export const RETENTION_TIERS: readonly RetentionTier[] = [
  { maxBytes: 2 * GB, maxHours: 168 }, // 7 days — matches what competitors give away free
  { maxBytes: 10 * GB, maxHours: 24 },
  { maxBytes: 50 * GB, maxHours: 6 },
];

/** The largest file the link path will accept at all, absent an env override. */
export const MAX_LINK_BYTES = RETENTION_TIERS[RETENTION_TIERS.length - 1].maxBytes;

/** The windows a sender can choose between, longest last. */
export const RETENTION_CHOICES = [1, 24, 72, 168] as const;

/**
 * The window this file gets for the base ad, or null if it's too big for the
 * link path entirely. `ceilingBytes` lets a deployment lower the size limit
 * below the ladder's own top tier (MAX_UPLOAD_BYTES) without changing the tiers.
 */
export function maxRetentionHoursFor(bytes: number, ceilingBytes = MAX_LINK_BYTES): number | null {
  if (!(bytes > 0) || bytes > ceilingBytes) return null;
  for (const tier of RETENTION_TIERS) {
    if (bytes <= tier.maxBytes) return tier.maxHours;
  }
  return null;
}

/** Nothing is ever kept longer than this, however many ads are on offer. */
export const ABSOLUTE_MAX_HOURS = 168;

/**
 * Above this size, a link is single-download whether or not the sender asked
 * for it.
 *
 * This is the abuse control that makes a 50GB ceiling survivable. Distributing
 * pirated or malicious material needs ONE file and MANY downloaders; a link
 * that dies on first use is worthless for that, while remaining exactly right
 * for what large files are actually sent for — one video to one editor, one
 * archive to one colleague. It costs a legitimate sender nothing and costs a
 * distributor everything, which is the shape a good control has.
 *
 * Small files stay multi-download: they're the ones people reasonably share
 * with a group, and at that size the site is no more useful for distribution
 * than a hundred other places.
 */
export const SINGLE_DOWNLOAD_ABOVE_BYTES = 2 * GB;

/** Whether a file of this size is forced to be a one-time link. */
export function forcesSingleDownload(bytes: number): boolean {
  return bytes > SINGLE_DOWNLOAD_ABOVE_BYTES;
}

/**
 * The longest window this file could have if the sender watched the maximum
 * number of ads — derived from what those ads recover rather than picked, so
 * the site can never be talked into storing more than it earns.
 *
 * Always at least the base window: every tier is comfortably affordable, and a
 * ceiling below the free allowance would be nonsense.
 */
export function maxPurchasableHours(bytes: number, ceilingBytes = MAX_LINK_BYTES): number | null {
  const base = maxRetentionHoursFor(bytes, ceilingBytes);
  if (base === null) return null;
  const costPerHour = storageCostUsd(bytes, 1);
  if (costPerHour <= 0) return ABSOLUTE_MAX_HOURS;
  const affordable = Math.floor(MAX_RECOVERABLE_USD / costPerHour);
  return Math.min(ABSOLUTE_MAX_HOURS, Math.max(base, affordable));
}

export interface RetentionOptions {
  /**
   * Whether longer windows can be bought with extra ads. With no ad network
   * there is nothing to buy them with, so the base ladder is the whole story.
   */
  adsEnabled?: boolean;
  ceilingBytes?: number;
}

/**
 * The retention options to offer for a file of this size, shortest first. The
 * base tier is always included even when it isn't one of the standard choices,
 * so a 50GB file offers "6 hours" rather than silently collapsing to the single
 * hour that happens to be on the standard list.
 */
export function retentionChoicesFor(bytes: number, options: RetentionOptions = {}): number[] {
  const ceilingBytes = options.ceilingBytes ?? MAX_LINK_BYTES;
  const base = maxRetentionHoursFor(bytes, ceilingBytes);
  if (base === null) return [];
  const max = options.adsEnabled ? (maxPurchasableHours(bytes, ceilingBytes) ?? base) : base;
  const choices = new Set<number>(RETENTION_CHOICES.filter((h) => h <= max));
  choices.add(base);
  return [...choices].sort((a, b) => a - b);
}

/** How a retention window is written in the UI. */
export function retentionLabel(hours: number): string {
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = hours / 24;
  return Number.isInteger(days) ? `${days} day${days === 1 ? "" : "s"}` : `${hours} hours`;
}

/**
 * Clamps a requested window to what this file is allowed, so a request that
 * asks for longer gets the longest it can have rather than an error. What
 * "allowed" means depends on whether the extra hours can be paid for: the
 * caller still has to check that the ads were actually watched (see
 * consumeAdReceipt), this only decides what is purchasable at all.
 */
export function clampRetentionHours(requestedHours: number, bytes: number, options: RetentionOptions = {}): number | null {
  const ceilingBytes = options.ceilingBytes ?? MAX_LINK_BYTES;
  const base = maxRetentionHoursFor(bytes, ceilingBytes);
  if (base === null) return null;
  const max = options.adsEnabled ? (maxPurchasableHours(bytes, ceilingBytes) ?? base) : base;
  return Math.min(Math.max(Math.round(requestedHours) || 1, 1), max);
}
