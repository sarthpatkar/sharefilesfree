// How long a shared link is allowed to live, as a function of how big it is.
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
// Pure and isomorphic on purpose: the upload API enforces this ladder and the
// send UI renders its options from the same source, so the two cannot drift.

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
 * The longest this file may be kept, or null if it's too big for the link path
 * entirely. `ceilingBytes` lets a deployment lower the size limit below the
 * ladder's own top tier (MAX_UPLOAD_BYTES) without changing the tiers.
 */
export function maxRetentionHoursFor(bytes: number, ceilingBytes = MAX_LINK_BYTES): number | null {
  if (!(bytes > 0) || bytes > ceilingBytes) return null;
  for (const tier of RETENTION_TIERS) {
    if (bytes <= tier.maxBytes) return tier.maxHours;
  }
  return null;
}

/**
 * The retention options to offer for a file of this size, shortest first. The
 * tier's own maximum is always included even when it isn't one of the standard
 * choices, so a 50GB file offers "6 hours" rather than silently collapsing to
 * the single hour that happens to be on the standard list.
 */
export function retentionChoicesFor(bytes: number, ceilingBytes = MAX_LINK_BYTES): number[] {
  const max = maxRetentionHoursFor(bytes, ceilingBytes);
  if (max === null) return [];
  const choices = new Set<number>(RETENTION_CHOICES.filter((h) => h <= max));
  choices.add(max);
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
 * asks for longer gets the longest it can have rather than an error.
 */
export function clampRetentionHours(requestedHours: number, bytes: number, ceilingBytes = MAX_LINK_BYTES): number | null {
  const max = maxRetentionHoursFor(bytes, ceilingBytes);
  if (max === null) return null;
  return Math.min(Math.max(Math.round(requestedHours) || 1, 1), max);
}
