"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { adsEnabled } from "./adNetwork";

const DISMISSED_KEY = "sff-ads-notice";

/**
 * Tells people, once, that this site is paid for by ads and that the ad partner
 * sets cookies. Appears only on a deployment where ads are actually switched on.
 *
 * WHAT THIS IS NOT: a consent management platform. It informs, it does not
 * gate — nothing is blocked while it is on screen and dismissing it grants
 * nothing. That is adequate for a site serving India, where the substantive
 * DPDP obligations begin in May 2027 and transparency is the immediate duty.
 *
 * It is NOT adequate for the EEA or the UK. Serving Google ads to visitors
 * there requires a Google-certified CMP collecting real, granular consent
 * before any ad tag fires, and a hand-rolled bar like this one does not qualify
 * however carefully it is worded. If ads are ever enabled for European traffic,
 * a certified CMP has to come first — this component is a stopgap for the
 * launch market, not the finished answer.
 *
 * Deliberately not a blocking overlay: the visitor came here to move a file,
 * and a modal between them and that is exactly the pattern that makes people
 * leave.
 */
export function AdsNotice() {
  // Starts hidden and is revealed after mount, so the server and the client
  // render the same markup — localStorage doesn't exist during SSR.
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!adsEnabled()) return;
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      // Private mode, or site data blocked. Showing the notice again is the
      // safe direction — it is information, so repeating it costs nothing.
    }
    if (dismissed) return;
    // Deferred rather than set in the effect body, the same way ReceivePanel
    // handles its one-time bootstrap: React flags a synchronous setState there
    // as a cascading render, and this is a one-time reveal either way.
    const timer = setTimeout(() => setShow(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  function dismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Nothing to do — it will reappear next visit, which is harmless.
    }
    setShow(false);
  }

  return (
    <aside
      aria-label="How this site is funded"
      /* z-30 deliberately: the header is z-50 and the mobile menu overlay is
         z-40, and this renders after both in the DOM — at an equal z-index it
         would paint on top of an open menu. */
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-black bg-y-max px-5 py-4 sm:px-8"
    >
      <div className="mx-auto flex w-full max-w-[1400px] flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
        <p className="text-[13px] font-medium leading-[1.5] text-black">
          ShareFilesFree is free because ads pay for it — never because we charge you or cap your files. Our ad
          partner sets cookies to choose and measure what you see.{" "}
          <Link href="/privacy" className="link text-red">
            What that means
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="sff-nudge shrink-0 bg-red px-5 py-2.5 text-[12px] font-bold uppercase leading-none tracking-[0.12em] text-y-pale"
        >
          Got it
        </button>
      </div>
    </aside>
  );
}
