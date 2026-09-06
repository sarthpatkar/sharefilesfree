// Aggregate-only counters. Deliberately not analytics.
//
// This exists to answer exactly one class of question that nothing could answer
// before: what fraction of connections succeed, and what fraction of them fall
// back to the TURN relay. The second number matters more than it looks —
// relayed bytes are the overwhelming majority of what this service costs to
// run, so the relay ratio is the difference between a hosting bill of tens of
// dollars and one of thousands. It was previously unmeasured, which meant
// nobody could say what the service cost at scale, or whether a change had
// helped.
//
// WHAT THIS IS NOT, and why that is a hard constraint rather than a preference
// --------------------------------------------------------------------------
// The privacy policy says, in writing, that the only thing logged is an IP
// address held in memory against rate limits, and that there is no transfer
// history "not because we delete them, but because the way this service is
// built means they never exist". It also promises that any analytics added
// would avoid individual profiling and that the page would be updated BEFORE
// they appeared.
//
// So this sends no identifier, sets no cookie, and reports nothing about a
// specific transfer: not a filename, not a size, not a peer, not a timestamp
// that could order one transfer against another. It increments a small set of
// named counters and nothing else. A counter is a total, not a history — which
// is what keeps the policy's claim true — and the policy has been updated to
// describe it either way.
//
// If a future change wants per-event records, that is a different thing with a
// different privacy story and the policy has to change first, not after.

/** The only events that may be counted. Anything else is dropped server-side. */
export type MetricEvent =
  | "connection-direct" // peers reached each other without a relay
  | "connection-relay" // fell back to TURN — the one that costs money
  | "connection-failed" // ICE gave up entirely
  | "transfer-complete"; // a file finished arriving

/**
 * Fire-and-forget. Never awaited, never surfaced, never allowed to affect a
 * transfer: a metric that can break the thing it measures is worse than no
 * metric. `sendBeacon` is used where available because it survives the page
 * being closed, which is exactly when a transfer tends to end.
 */
export function countMetric(event: MetricEvent) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ event });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/metrics", new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch("/api/metrics", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // Counting is best-effort by definition.
  }
}
