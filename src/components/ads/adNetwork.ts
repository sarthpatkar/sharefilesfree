// The one place that knows which ad network we're on.
//
// Everything else in the app talks about "a slot" or "a gate" and never about
// AdSense, so switching networks — or running two — is a change to this file
// and nothing else. Today it implements AdSense because that's the realistic
// first approval for this site, plus a "house" mode that draws a labelled
// placeholder so the layout can be designed and reviewed before any network
// account exists.
//
// Nothing here runs unless an env var says so, so a deployment with no ad
// account behaves exactly as it did before: no script, no slot, no gate.

/** Set to an AdSense publisher id (ca-pub-...) to serve real ads. */
export function adClientId(): string | null {
  return process.env.NEXT_PUBLIC_AD_CLIENT || null;
}

/** Set to 1 to draw labelled placeholders instead — for design review and local dev. */
export function houseAdsOnly(): boolean {
  return !adClientId() && process.env.NEXT_PUBLIC_AD_HOUSE === "1";
}

export function adsEnabled(): boolean {
  return Boolean(adClientId()) || houseAdsOnly();
}

let scriptPromise: Promise<boolean> | null = null;

/**
 * Loads the network's script once, lazily — never on first paint. Ad JS is the
 * single heaviest third party a page like this will ever load, and pulling it
 * in eagerly would cost the LCP that the tool pages' search ranking depends on,
 * which is the traffic the ads are sold against. So it is fetched only when a
 * slot has actually scrolled close to the viewport.
 */
export function loadAdScript(): Promise<boolean> {
  if (scriptPromise) return scriptPromise;
  const client = adClientId();
  if (!client) return (scriptPromise = Promise.resolve(false));

  scriptPromise = new Promise<boolean>((resolve) => {
    const src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`;
    const existing = document.querySelector<HTMLScriptElement>(`script[src^="https://pagead2.googlesyndication.com"]`);
    if (existing) return resolve(true);

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.crossOrigin = "anonymous";
    // A blocked script (ad blocker, offline, network policy) is an expected
    // state, not an error: every caller has a no-fill path.
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.head.appendChild(script);
  });
  return scriptPromise;
}

interface AdsByGoogle {
  push(config: Record<string, unknown>): void;
}

/**
 * Fills an element with a banner. Returns false when nothing could be served,
 * which the caller uses to collapse the slot rather than leave a hole.
 */
export async function mountBanner(el: HTMLElement, slotId: string): Promise<boolean> {
  const client = adClientId();
  if (!client) return false;
  const ok = await loadAdScript();
  if (!ok) return false;

  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.display = "block";
  ins.style.width = "100%";
  ins.dataset.adClient = client;
  ins.dataset.adSlot = slotId;
  ins.dataset.adFormat = "auto";
  ins.dataset.fullWidthResponsive = "true";
  el.replaceChildren(ins);

  try {
    const w = window as unknown as { adsbygoogle?: AdsByGoogle };
    w.adsbygoogle = w.adsbygoogle || ([] as unknown as AdsByGoogle);
    w.adsbygoogle.push({});
    return true;
  } catch {
    return false;
  }
}
