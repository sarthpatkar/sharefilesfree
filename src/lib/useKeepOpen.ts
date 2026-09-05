"use client";

import { useEffect } from "react";

/**
 * Keeps a transfer alive against the two ways a browser quietly kills one.
 *
 * This matters more than it used to. When a file could be parked on storage,
 * closing the tab was survivable. Now the file lives on the sender's own
 * machine for as long as the code lasts — up to two hours — so the tab IS the
 * transfer, and losing it loses everything with no error and no way back.
 *
 *   1. Closing or navigating away. The browser is asked to confirm first.
 *      Browsers deliberately ignore any custom message here and show their own
 *      wording, so there is nothing to pass in — the value is the pause.
 *   2. The screen sleeping. A laptop that dozes while waiting drops the
 *      connection. A wake lock holds it off, where the browser grants one.
 *
 * Both are best-effort by design. A wake lock is refused on some browsers and
 * released whenever the tab is hidden, and the confirmation dialog only appears
 * if the user has interacted with the page. Neither failure breaks anything
 * that was working before.
 */
export function useKeepOpen(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // Legacy browsers keyed off the return value rather than preventDefault.
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        if (!("wakeLock" in navigator) || released) return;
        sentinel = await navigator.wakeLock.request("screen");
      } catch {
        // Refused (unsupported, low battery, not visible). Nothing to do — the
        // transfer still works, it is just easier for the device to interrupt.
      }
    };

    // A wake lock is dropped whenever the tab is hidden and is not restored
    // automatically, so it has to be taken again on every return to the page.
    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
