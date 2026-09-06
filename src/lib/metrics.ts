// Aggregate-only counters. Deliberately not analytics.
//
// This exists to answer questions nothing could answer before: what fraction of
// connections succeed, what fraction fall back to the paid TURN relay, and how
// much this service has actually moved. The relay ratio matters most — relayed
// bytes are the overwhelming majority of what this costs to run, so that one
// number is the difference between a hosting bill of tens of dollars and one of
// thousands.
//
// Some of it is also just worth showing people. /stats is a public page, and the
// honest version of this product's pitch is a number: bytes moved, next to bytes
// stored, which is zero.
//
// WHAT THIS IS NOT, and why that is a hard constraint rather than a preference
// --------------------------------------------------------------------------
// The privacy policy promises there is no transfer history "not because we
// delete them, but because the way this service is built means they never
// exist", and that any analytics added would avoid individual profiling and be
// described on that page BEFORE appearing.
//
// So this sends no identifier, sets no cookie, and reports nothing about a
// specific transfer: no filename, no peer, no timestamp that could order one
// transfer against another. It adds to a handful of running totals. A total is
// not a history — which is what keeps the policy's claim true — and the policy
// describes it either way.
//
// A file's size is included in those totals. That is the one judgement call
// here: a size is a fact about a transfer. It is only ever added into a sum
// that already contains everyone else's, never stored on its own, so what
// survives is "N bytes moved in total" and nothing that could be picked apart
// again. The single exception is the largest transfer seen, which is one number
// with nothing attached to it — no name, no time, no owner.

/** The only events that may be counted. Anything else is dropped server-side. */
export type MetricEvent =
  | "connection-direct" // peers reached each other without a relay
  | "connection-relay" // fell back to TURN — the one that costs money
  | "connection-failed" // ICE gave up entirely
  | "transfer-complete" // a batch finished arriving
  | "visit"; // one browsing session, counted once — see countVisit

interface MetricPayload {
  event: MetricEvent;
  /** Only for "transfer-complete": how many files, and how many bytes in total. */
  files?: number;
  bytes?: number;
  /** Only for "transfer-complete": the largest single file in the batch. */
  largest?: number;
}

/**
 * Fire-and-forget. Never awaited, never surfaced, never allowed to affect a
 * transfer: a metric that can break the thing it measures is worse than no
 * metric. `sendBeacon` is used where available because it survives the page
 * being closed, which is exactly when a transfer tends to end.
 */
function report(payload: MetricPayload) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/metrics", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/metrics", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // Counting is best-effort by definition.
  }
}

export function countMetric(event: Exclude<MetricEvent, "transfer-complete">) {
  report({ event });
}

/** Reports a finished batch: how many files and how many bytes actually landed. */
export function countTransfer(files: number, bytes: number, largest: number) {
  report({ event: "transfer-complete", files, bytes, largest });
}

/**
 * One per browsing session, not one per page view.
 *
 * A session is the more honest unit for a public "visits" number, and it keeps
 * this to a single beacon no matter how many tool pages someone opens. It is
 * held in sessionStorage rather than a cookie: it never leaves the browser, is
 * not an identifier, and is gone when the tab closes.
 *
 * It has to be a beacon rather than something the server counts, because pages
 * are served from Cloudflare's edge and the origin never sees most of them.
 * That also means ad blockers will suppress some of these, so the number is a
 * floor rather than a measurement — which is worth stating wherever it is shown.
 */
export function countVisit() {
  if (typeof window === "undefined") return;
  try {
    if (sessionStorage.getItem("sff-counted") === "1") return;
    sessionStorage.setItem("sff-counted", "1");
  } catch {
    // Private mode, or storage disabled. Counting once per page load is a fine
    // fallback — over-counting a little beats a page that reports nothing.
  }
  report({ event: "visit" });
}
