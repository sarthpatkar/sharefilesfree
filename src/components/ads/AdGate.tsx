"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { planFor, type AdPurpose } from "@/lib/ads";
import { ProgressBar } from "../ProgressBar";
import { Button } from "../Button";
import { adsEnabled, houseAdsOnly, mountBanner } from "./adNetwork";

interface AdGateProps {
  purpose: AdPurpose;
  /** What the user is waiting for, e.g. "Your code". Shown so the wait has a stated reason. */
  waitingFor: string;
  onPass: () => void;
  onCancel: () => void;
}

/**
 * The few seconds between an action and its result on the two moments in a
 * transfer where the user is already waiting.
 *
 * Three deliberate choices, all of them about not getting the site's ads
 * blocked by Chrome:
 *
 *   - It renders IN FLOW, where the result would have appeared — not as a
 *     full-screen overlay. A countdown that covers the page on entry is a
 *     "prestitial with countdown", which is on the Coalition for Better Ads
 *     disallowed list for mobile web, and repeat violations get ads blocked
 *     sitewide. This is a step in a flow the user started, which is different.
 *   - It is always reached by the user's own click, never by a page load.
 *   - Cancel is always available and always works.
 *
 * The countdown runs even when no ad could be served (blocked, no fill,
 * offline), because a wait that any ad blocker can skip is decoration. Nobody
 * is ever prevented from continuing; everyone waits the same few seconds.
 *
 * This is a client-side gate and there is nothing dishonest about that: it used
 * to redeem a server-signed receipt, because the thing on the other side was an
 * upload to storage we paid for. With no storage there is no cost to protect
 * here, only revenue to earn, and a server round trip to verify a five-second
 * timer would buy exactly nothing.
 */
export function AdGate({ purpose, waitingFor, onPass, onCancel }: AdGateProps) {
  const plan = planFor(purpose);
  const [msLeft, setMsLeft] = useState(plan.totalMs);
  const [filled, setFilled] = useState<boolean | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const house = houseAdsOnly();

  // onPass changes identity on every parent render; a ref keeps the timer below
  // from restarting on an unrelated one.
  const onPassRef = useRef(onPass);
  useEffect(() => {
    onPassRef.current = onPass;
  });

  /**
   * Fires exactly once. Without the guard it can fire twice — React Strict Mode
   * mounts effects twice in development, and the no-ads path passes straight
   * through inside an effect. Two calls means two rooms opened on the signaling
   * server, with the UI showing whichever finished last.
   */
  const passedRef = useRef(false);
  const pass = useCallback(() => {
    if (passedRef.current) return;
    passedRef.current = true;
    onPassRef.current();
  }, []);

  // No ad network on this deployment: straight through, no countdown, no flash.
  const enabled = adsEnabled();

  useEffect(() => {
    if (!enabled) {
      pass();
      return;
    }
    // Driven off a deadline rather than by decrementing, so a throttled or
    // backgrounded tab lands on the right number when it wakes.
    const deadline = Date.now() + plan.totalMs;
    const tick = setInterval(() => {
      const left = deadline - Date.now();
      setMsLeft(left > 0 ? left : 0);
      if (left <= 0) {
        clearInterval(tick);
        pass();
      }
    }, 100);
    return () => clearInterval(tick);
  }, [enabled, plan.totalMs, pass]);

  // Ask the network to fill the space. Failure is expected and handled.
  useEffect(() => {
    if (!enabled || house || filled !== null) return;
    const el = hostRef.current;
    if (!el) return;
    let live = true;
    void mountBanner(el, `gate-${purpose}`).then((ok) => live && setFilled(ok));
    return () => {
      live = false;
    };
  }, [enabled, house, filled, purpose]);

  if (!enabled) return null;

  const seconds = Math.ceil(msLeft / 1000);

  return (
    <section aria-live="polite" className="flex w-full flex-col gap-4">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-red">
          {seconds > 0 ? `${waitingFor} in ${seconds}s` : `${waitingFor} is ready…`}
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

      <ProgressBar fraction={Math.min(1, Math.max(0, 1 - msLeft / plan.totalMs))} />

      <Button variant="ghost" onClick={onCancel} className="self-start">
        Cancel
      </Button>
    </section>
  );
}
