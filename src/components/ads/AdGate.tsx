"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AdPurpose } from "@/lib/ads";
import { ProgressBar } from "../ProgressBar";
import { Button } from "../Button";
import { adsEnabled, houseAdsOnly, mountBanner } from "./adNetwork";

interface AdGateProps {
  purpose: AdPurpose;
  /** Only meaningful for "link-upload" — the ad load scales with what the file costs us. */
  bytes?: number;
  hours?: number;
  /** What the user is waiting for, e.g. "your code". Shown so the wait has a stated reason. */
  waitingFor: string;
  onPass: (receipt: string | null) => void;
  onCancel: () => void;
}

interface StartResponse {
  sessionId: string;
  slots: number;
  secondsPerSlot: number;
  totalMs: number;
}

/**
 * The gate that stands between an action and its result on the paths that
 * either cost us money or are worth money.
 *
 * Three deliberate choices, all of them about not getting the site's ads
 * blocked by Chrome:
 *
 *   - It renders IN FLOW, where the result would have appeared — not as a
 *     full-screen overlay. A countdown that covers the page on entry is a
 *     "prestitial with countdown", which is on the Coalition for Better Ads
 *     disallowed list for mobile web, and repeat violations get ads blocked
 *     sitewide. This is a step in a flow the user started, which is a
 *     different thing entirely.
 *   - It is always reached by the user's own click, never by a page load.
 *   - Cancel is always available and always works.
 *
 * The wait runs even when no ad could be served (blocked, no fill, offline).
 * That looks unfriendly for a second, and it's the only version that means
 * anything: if "no ad available" skipped the wait, then every blocker — and
 * every script claiming to be one — would skip it, and the gate would be
 * decoration. Nobody is ever blocked from continuing; everyone waits the same
 * few seconds. See lib/adGate.ts for the server half.
 */
export function AdGate({ purpose, bytes, hours, waitingFor, onPass, onCancel }: AdGateProps) {
  const [plan, setPlan] = useState<StartResponse | null>(null);
  const [msLeft, setMsLeft] = useState<number | null>(null);
  const [filled, setFilled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const house = houseAdsOnly();
  // onPass identity changes on every parent render; capturing it in a ref keeps
  // the effects below from re-running the whole session on an unrelated render.
  // Synced in an effect rather than during render, and declared before the
  // effects that read it so it is always current by the time they run.
  const onPassRef = useRef(onPass);
  useEffect(() => {
    onPassRef.current = onPass;
  });
  /**
   * onPass must fire exactly once. Without this it can fire twice — React
   * Strict Mode mounts effects twice in development, and the pass-through path
   * for a deployment with no ads runs entirely inside an effect. Two calls
   * means two rooms opened on the signaling server, or two uploads started,
   * with the UI showing whichever finished last.
   */
  const passedRef = useRef(false);
  const pass = useCallback((receipt: string | null) => {
    if (passedRef.current) return;
    passedRef.current = true;
    onPassRef.current(receipt);
  }, []);

  const redeem = useCallback(async (sessionId: string) => {
    // The local countdown and the server's clock can disagree — a backgrounded
    // tab throttles timers, so ours finishes late; a fast machine can finish a
    // hair early. 425 means "not yet, here's how long", so re-arm rather than
    // fail the user who genuinely waited.
    for (let attempt = 0; attempt < 4; attempt++) {
      const res = await fetch("/api/ad-session/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.receipt) return pass(body.receipt as string);
      if (res.status === 425 && typeof body.retryAfterMs === "number") {
        await new Promise((r) => setTimeout(r, Math.min(body.retryAfterMs + 150, 20_000)));
        continue;
      }
      return setError(body.error || "Something went wrong. Try again.");
    }
    setError("Something went wrong. Try again.");
  }, [pass]);

  // Open the session. A deployment with no ad network comes back with totalMs
  // 0 and this whole component is a pass-through in one round trip.
  useEffect(() => {
    let live = true;
    // No ad network on this deployment: don't even spend a round trip finding
    // that out. The server reaches the same conclusion from the same env vars,
    // so the enforcement side stays consistent with what's rendered here.
    if (!adsEnabled()) {
      pass(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch("/api/ad-session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ purpose, bytes, hours }),
        });
        const body = (await res.json()) as StartResponse & { error?: string };
        if (!live) return;
        if (!res.ok) throw new Error(body.error || "Could not start.");
        setPlan(body);
        if (body.totalMs === 0) return void redeem(body.sessionId);
        setMsLeft(body.totalMs);
      } catch {
        // Never let our own ad plumbing be the reason a transfer fails.
        if (live) pass(null);
      }
    })();
    return () => {
      live = false;
    };
  }, [purpose, bytes, hours, redeem, pass]);

  // Countdown driven off a deadline rather than by decrementing, so a
  // throttled or backgrounded tab lands on the right number when it wakes.
  useEffect(() => {
    if (!plan || plan.totalMs === 0) return;
    const deadline = Date.now() + plan.totalMs;
    const tick = setInterval(() => {
      const left = deadline - Date.now();
      setMsLeft(left > 0 ? left : 0);
      if (left <= 0) {
        clearInterval(tick);
        void redeem(plan.sessionId);
      }
    }, 100);
    return () => clearInterval(tick);
  }, [plan, redeem]);

  // Ask the network to fill the space. Failure is expected and handled.
  useEffect(() => {
    if (!plan || plan.totalMs === 0 || house || filled !== null) return;
    const el = hostRef.current;
    if (!el) return;
    let live = true;
    void mountBanner(el, `gate-${purpose}`).then((ok) => live && setFilled(ok));
    return () => {
      live = false;
    };
  }, [plan, house, filled, purpose]);

  if (!plan || plan.totalMs === 0) return null;

  const seconds = Math.ceil((msLeft ?? plan.totalMs) / 1000);
  const elapsed = 1 - (msLeft ?? plan.totalMs) / plan.totalMs;

  return (
    <section aria-live="polite" className="flex w-full flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">
          {seconds > 0 ? `${waitingFor} in ${seconds}s` : `Loading ${waitingFor}…`}
        </p>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-black opacity-40">
          {!house && filled === false ? "No ad available" : "Advertisement"}
        </p>
      </div>

      <div
        ref={hostRef}
        style={{ minHeight: 250 }}
        className={house || filled ? "flex items-center justify-center bg-lime-4" : "flex items-center justify-center bg-lime-pale"}
      >
        {house && (
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-black opacity-45">
            house ad · {purpose}
          </span>
        )}
        {!house && filled === false && (
          <span className="max-w-xs px-6 text-center text-[13px] font-semibold leading-[1.5] text-black opacity-55">
            Nothing to show right now — this is what keeps ShareFilesFree free. You&apos;re through in a moment.
          </span>
        )}
      </div>

      <ProgressBar fraction={Math.min(1, Math.max(0, elapsed))} />

      {plan.slots > 1 && (
        <p className="text-[13px] font-medium leading-[1.5] text-black opacity-55">
          Bigger file, kept for longer — that&apos;s {plan.slots} short ads instead of one. Storing it is the only part
          of this site that costs us money.
        </p>
      )}

      {error && (
        <p role="alert" className="bg-red px-4 py-3 text-[14px] font-semibold leading-[1.45] text-y-pale">
          {error}
        </p>
      )}

      <Button variant="ghost" onClick={onCancel} className="self-start">
        Cancel
      </Button>
    </section>
  );
}
