"use client";

import { useEffect } from "react";

/** Registers /public/sw.js — see that file for the actual caching strategy and its honest scope. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal — the app works fully online-only if this fails for any reason.
      });
    }
  }, []);
  return null;
}
