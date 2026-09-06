"use client";

import { useEffect } from "react";
import { countVisit } from "@/lib/metrics";

/** Registers /public/sw.js — see that file for the actual caching strategy and its honest scope. */
export function ServiceWorkerRegister() {
  // One beacon per browsing session, for the public counter on /stats. It lives
  // here because this component is already mounted on every page and already
  // exists to do a single fire-and-forget thing on load.
  useEffect(() => {
    countVisit();
  }, []);

  useEffect(() => {
    // Production only. In development, Turbopack serves chunks from
    // /_next/static/ with URLs that are NOT content-hashed — the same URL
    // returns different bytes after every edit. The worker treats that prefix
    // as immutable and cache-first, which is correct against a real build and
    // poisons a dev server within one save.
    if (process.env.NODE_ENV !== "production") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Non-fatal — the app works fully online-only if this fails for any reason.
      });
    }
  }, []);
  return null;
}
