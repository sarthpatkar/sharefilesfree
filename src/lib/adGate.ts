// Server side of the ad gate: hands out ad sessions, and issues a one-use
// receipt once a session has actually run its course.
//
// Why this exists at all, rather than the client just showing an ad and then
// calling the upload API: an ad gate that lives only in the browser is worth
// nothing against `curl`. The people most worth gating — the ones parking
// gigabytes on storage we rent — are exactly the ones who would skip it. So
// the thing that costs money (/api/upload-url) requires a receipt that only
// this module issues, and only after the clock has run on the server's own
// terms.
//
// What this can and cannot prove
// ------------------------------
// It proves TIME PASSED between asking for the ad and claiming it finished.
// It does NOT prove a human watched an ad — no browser API can, and pretending
// otherwise would be theatre. Real proof needs the ad network's server-side
// verification callback, which lands in completeAdSession() when a network is
// wired up (see the note there). Until then the honest property is: skipping
// the ad saves you nothing, because the wait is enforced either way.
//
// Same in-memory caveat as lib/rateLimit.ts — this is single-process state
// that resets on deploy. Sessions live for minutes, so a restart costs at
// worst one re-watch. Behind multiple instances this needs a shared store.
import { randomBytes } from "node:crypto";
import { planFor, type AdPlan, type AdPurpose } from "./ads";

/** Ad sessions and receipts are both short-lived; anything older is swept. */
const SESSION_TTL_MS = 30 * 60 * 1000;
const RECEIPT_TTL_MS = 30 * 60 * 1000;

/**
 * A gate is priced before the bytes exist in their final form: bundling
 * several files into one zip adds a container the browser can't measure
 * without building it, and building it would have to happen before the ad
 * rather than during it. So the receipt is credited with a little headroom —
 * far too small to matter at the price of storage, far too small to walk a
 * 10MB receipt up to a 50GB upload.
 */
const CLAIM_HEADROOM_BYTES = 1024 * 1024;

/**
 * Clocks drift and timers fire a hair early; without this a user who sat
 * through the whole ad is told they didn't. Small enough that it buys an
 * attacker nothing.
 */
const CLOCK_SLOP_MS = 250;

interface Session {
  purpose: AdPurpose;
  plan: AdPlan;
  /** The cost basis this session was priced for — the receipt inherits it. */
  bytes: number;
  hours: number;
  startedAt: number;
  completed: boolean;
}

interface Receipt {
  purpose: AdPurpose;
  bytes: number;
  hours: number;
  issuedAt: number;
}

const sessions = new Map<string, Session>();
const receipts = new Map<string, Receipt>();

function sweep() {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.startedAt > SESSION_TTL_MS) sessions.delete(id);
  for (const [id, r] of receipts) if (now - r.issuedAt > RECEIPT_TTL_MS) receipts.delete(id);
}

// Both maps are keyed by values an anonymous caller can create, so they only
// ever grow without this. Unref'd so it never holds the process open.
const sweeper = setInterval(sweep, 60 * 1000);
if (typeof sweeper === "object" && "unref" in sweeper) sweeper.unref();

/** True when a deployment has an ad network wired up at all. */
export function adsEnabled(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_AD_CLIENT || process.env.NEXT_PUBLIC_AD_HOUSE);
}

export interface StartedSession {
  sessionId: string;
  plan: AdPlan;
}

/**
 * Opens a session and prices it. When no ad network is configured the plan
 * comes back with zero slots — the caller then sails straight through, so a
 * deployment without ads behaves exactly as it did before any of this existed.
 * Note the decision is the SERVER's: a client cannot claim "no ads here".
 */
export function startAdSession(purpose: AdPurpose, bytes = 0, hours = 24): StartedSession {
  const plan = adsEnabled() ? planFor(purpose, { bytes, hours }) : { purpose, slots: 0, secondsPerSlot: 0, totalMs: 0 };
  const sessionId = randomBytes(16).toString("hex");
  sessions.set(sessionId, { purpose, plan, bytes, hours, startedAt: Date.now(), completed: false });
  return { sessionId, plan };
}

export type CompleteResult = { ok: true; receipt: string } | { ok: false; error: string; retryAfterMs?: number };

/**
 * Redeems a session for a receipt, if its clock has genuinely run out.
 *
 * When a real ad network is wired up, its server-side verification callback
 * belongs here: keep the elapsed-time check as the floor, and additionally
 * require that the network has confirmed the impression for this session id.
 */
export function completeAdSession(sessionId: string): CompleteResult {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, error: "That ad session expired. Try again." };
  // One receipt per session, or a single watch could be replayed indefinitely.
  if (session.completed) return { ok: false, error: "That ad session was already used." };

  const elapsed = Date.now() - session.startedAt;
  if (elapsed + CLOCK_SLOP_MS < session.plan.totalMs) {
    return { ok: false, error: "The ad hasn't finished yet.", retryAfterMs: session.plan.totalMs - elapsed };
  }

  session.completed = true;
  const receipt = randomBytes(24).toString("hex");
  receipts.set(receipt, { purpose: session.purpose, bytes: session.bytes, hours: session.hours, issuedAt: Date.now() });
  return { ok: true, receipt };
}

export interface ReceiptClaim {
  purpose: AdPurpose;
  bytes?: number;
  hours?: number;
}

/**
 * Spends a receipt. Single use, and it only covers what it was priced for:
 * a receipt earned by sitting through the ads for a 10MB file cannot be
 * presented for a 50GB one, which is the obvious way to cheat the ladder if
 * the receipt were a plain "I watched something" token.
 */
export function consumeAdReceipt(receipt: unknown, claim: ReceiptClaim): boolean {
  if (!adsEnabled()) return true; // nothing to enforce on a deployment with no ads

  // Some actions are priced at no ads at all — a small upload is over before an
  // ad could play and costs a fraction of a cent to keep. Those must pass
  // WITHOUT a receipt, or the ungated path would 402 the moment ads went live.
  const wantedSlots = planFor(claim.purpose, { bytes: claim.bytes ?? 0, hours: claim.hours ?? 24 }).slots;
  if (wantedSlots === 0) return true;

  if (typeof receipt !== "string" || !/^[a-f0-9]{48}$/.test(receipt)) return false;

  // A plain Map lookup, deliberately: the token is 24 random bytes, so there
  // is no prefix worth learning from a timing difference and nothing a
  // constant-time scan of the whole table would buy.
  const found = receipts.get(receipt);
  if (!found || found.purpose !== claim.purpose) return false;

  // The receipt has to cover at least what's now being asked for.
  const paidSlots = planFor(found.purpose, { bytes: found.bytes + CLAIM_HEADROOM_BYTES, hours: found.hours }).slots;
  if (paidSlots < wantedSlots) return false;

  receipts.delete(receipt);
  return true;
}

/** Test seam — resets module state between cases. */
export function __resetAdGate() {
  sessions.clear();
  receipts.clear();
}
