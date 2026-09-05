"use client";

import { useEffect, useRef, useState } from "react";
import { AD_FORMATS, type AdFormat } from "@/lib/ads";
import { adsEnabled, houseAdsOnly, mountBanner } from "./adNetwork";

interface AdSlotProps {
  /** The network's slot id. With house ads on, it's just a label on the placeholder. */
  slotId: string;
  format?: AdFormat;
  className?: string;
}

/**
 * A banner position. Two things make it worth being a component rather than a
 * div with a script in it:
 *
 *   1. It reserves its height BEFORE anything loads. An ad that arrives into
 *      unreserved space shifts the page, and layout shift moves Core Web
 *      Vitals, which moves the search ranking that brings the tool traffic
 *      these ads are sold against. Reserving space isn't politeness, it's the
 *      business model protecting itself.
 *   2. It doesn't load until it's nearly on screen, so ad JS never competes
 *      with the transfer or a tool for the main thread.
 *
 * On a deployment with no ad account it renders nothing at all and occupies no
 * space, so the site today looks exactly as it does now.
 */
export function AdSlot({ slotId, format = "leaderboard", className = "" }: AdSlotProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [filled, setFilled] = useState<boolean | null>(null);
  const spec = AD_FORMATS[format];
  // Env-derived and therefore constant for the life of the page, identical on
  // server and client — safe to read during render, and keeping it out of
  // state is what stops the fill effect from setting state synchronously.
  const house = houseAdsOnly();

  useEffect(() => {
    const el = hostRef.current;
    if (!el || !adsEnabled()) return;
    // A slot that starts on screen must still load — observe() fires
    // immediately in that case, so there's no special first-paint branch.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!near || house || filled !== null) return;
    const el = hostRef.current;
    if (!el) return;
    let live = true;
    void mountBanner(el, slotId).then((ok) => live && setFilled(ok));
    return () => {
      live = false;
    };
  }, [near, house, filled, slotId]);

  if (!adsEnabled()) return null;

  // No fill — collapse rather than leave a labelled empty box on the page.
  if (!house && filled === false) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={`mx-auto w-full ${className}`}
      style={{ maxWidth: spec.maxWidth }}
    >
      {/* Required by most networks' policies and by plain honesty: a visitor
          must be able to tell an ad from the product without clicking it. */}
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-black opacity-40">Advertisement</p>
      <div
        ref={hostRef}
        style={{ minHeight: spec.minHeight }}
        className={house ? "flex items-center justify-center bg-lime-4" : undefined}
      >
        {house && (
          <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-black opacity-45">
            {spec.label} · {slotId}
          </span>
        )}
      </div>
    </aside>
  );
}
