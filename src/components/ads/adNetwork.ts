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

/**
 * BEFORE SETTING THIS FOR EUROPEAN TRAFFIC — read this.
 *
 * The privacy policy commits, in writing, that ads will not be served to
 * visitors in the EEA or UK until a proper consent mechanism exists. Serving
 * Google ads there requires a Google-certified CMP collecting granular consent
 * before any ad tag fires; the notice bar in AdsNotice.tsx informs, it does not
 * consent, and does not qualify.
 *
 * Nothing in this file enforces that geographically — there is no geo check
 * here, and setting the publisher id below turns ads on for everyone. So the
 * commitment currently lives in a promise rather than in code, which is only
 * acceptable while the answer is "no ads anywhere".
 *
 * DO NOT SOLVE THIS BY BLOCKING EUROPE. That was the first instinct and it is
 * the wrong one — the UK and EEA are among the highest-paying ad markets there
 * are, and turning them off to stay compliant would cost far more revenue than
 * the rest of the site earns.
 *
 * The correct fix is a consent banner, and Google gives one away: AdSense has a
 * built-in, Google-certified GDPR message (Privacy & messaging -> GDPR) that
 * shows a consent prompt to EEA and UK visitors and records the result. It costs
 * nothing and needs no code here.
 *
 * It is also not optional in practice. Google's own EU user consent policy
 * requires a certified CMP for that traffic, and without one Google restricts
 * what it will serve there anyway. So the choice is not "ads in Europe or
 * compliance" — it is "a consent banner, or no European revenue".
 *
 * Order of operations when ads go live: enable the GDPR message in AdSense
 * first, then set the publisher id, then reword the privacy commitment above to
 * describe the banner that now exists. Setting the id first would make a written
 * privacy commitment false, which is a worse problem than having no ads.
 */

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
