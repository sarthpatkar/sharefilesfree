import type { NextConfig } from "next";

/**
 * Content-Security-Policy.
 *
 * This was deliberately left out for a while, with a note saying it needed a
 * live deployment to test against because the P2P path opens a cross-origin
 * WebSocket and WebRTC traffic that a naive `connect-src 'self'` would break.
 * That deployment exists now, so the reason to wait is gone — and shipping
 * nothing left the site with no answer at all to injected script, which is the
 * one class of bug that turns "we never see your files" into a false claim,
 * because script running on this origin sits inside the transfer.
 *
 * WHAT THIS POLICY CAN AND CANNOT DO, HONESTLY
 * --------------------------------------------
 * `script-src` below includes 'unsafe-inline', and that is not laziness. A
 * strict nonce-based policy requires a per-request nonce, which requires
 * rendering every page per request — and every page here is prerendered and
 * served from Cloudflare's edge cache, which is what keeps a 1-vCPU origin out
 * of the path of all traffic (see the Caddyfile). Nonces and that cache are
 * mutually exclusive, and the cache is load-bearing.
 *
 * So be clear about what is bought: this policy does NOT stop an injected
 * inline <script>. What it does stop is everything that attack normally needs
 * to be worth anything — pulling code in from an attacker's domain, posting
 * stolen data anywhere but here, framing the site, rewriting relative URLs
 * with an injected <base>, and loading a plugin. Those are the directives
 * below with no escape hatch in them, and they are exact.
 */
function contentSecurityPolicy(): string {
  // Derived from the configured signaling endpoint rather than hardcoded, so
  // the policy always matches the deployment it was built for — a local build
  // pointing at ws://localhost:8080 and production pointing at
  // wss://signal.sharefilesfree.com both come out right, and neither needs a
  // human to remember to update a list.
  const signaling = process.env.NEXT_PUBLIC_SIGNALING_URL || "ws://localhost:8080";
  let signalingOrigin = signaling;
  try {
    signalingOrigin = new URL(signaling).origin;
  } catch {
    // Malformed value — fall back to the raw string rather than throwing the
    // whole build. A broken signaling URL is already a broken deployment.
  }

  // AdSense pulls in a wide set of Google domains and injects iframes. They are
  // added ONLY when ads are actually configured: the client id is inlined at
  // build time, so a build with no ads gets a policy with no ad domains in it,
  // and turning ads on is a rebuild anyway. Tightest policy that matches what
  // is actually deployed, with nothing to remember later.
  const adsEnabled = Boolean(process.env.NEXT_PUBLIC_AD_CLIENT);
  const adScript = adsEnabled
    ? [
        "https://pagead2.googlesyndication.com",
        "https://adservice.google.com",
        "https://tpc.googlesyndication.com",
        "https://www.googletagservices.com",
        "https://partner.googleadservices.com",
        "https://ep2.adtrafficquality.google",
      ]
    : [];
  const adFrame = adsEnabled
    ? [
        "https://googleads.g.doubleclick.net",
        "https://tpc.googlesyndication.com",
        "https://www.google.com",
        "https://ep2.adtrafficquality.google",
      ]
    : [];
  const adConnect = adsEnabled
    ? [
        "https://pagead2.googlesyndication.com",
        "https://googleads.g.doubleclick.net",
        "https://ep1.adtrafficquality.google",
        "https://ep2.adtrafficquality.google",
        "https://csi.gstatic.com",
      ]
    : [];

  // The OCR tool's language data, and ONLY its language data.
  //
  // tesseract.js used to fetch three things from jsDelivr at runtime: its
  // worker script, its ~4MB WebAssembly core, and the trained data for the
  // language chosen. The first two are executable code, and allowing a third
  // party to supply executable code to a page that handles people's files is
  // the supply-chain risk in its plainest form — so both are now served from
  // this origin instead (scripts/copy-vendor-assets.mjs, wired up in
  // src/lib/tools/ocr.ts), which is why script-src below has no CDN in it and
  // no off-origin script can load at all.
  //
  // What remains is langPath: a trained model that the WASM reads as data
  // rather than executes. That is a materially smaller risk than code, and
  // closing it means vendoring thirteen languages most visitors never use.
  // It is connect-src only — it cannot become script.
  const ocrLangData = "https://cdn.jsdelivr.net";

  // Cloudflare's Web Analytics / Browser Insights beacon.
  //
  // Cloudflare's proxy injects this into HTML responses itself, and only for
  // requests it judges to be real browsers — it is absent from the same page
  // fetched with curl, which is exactly why a header-level check does not
  // reveal it and why the first CSP shipped without it silently switched the
  // site's only analytics off. Found by driving the live site in a real
  // browser; nothing short of that would have caught it.
  //
  // Allowing it grants no trust that is not already granted. Cloudflare
  // terminates TLS for this domain: it can already read and rewrite every
  // byte of every response, which is precisely how this script gets onto the
  // page. Refusing its beacon while accepting its proxy would be theatre.
  //
  // The script comes from static.cloudflareinsights.com and reports back to
  // cloudflareinsights.com, so the two hosts differ and both are needed.
  const cfInsightsScript = "https://static.cloudflareinsights.com";
  const cfInsightsBeacon = "https://cloudflareinsights.com";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],

    // 'wasm-unsafe-eval' is required, not optional: the OCR tool runs
    // tesseract.js, which instantiates WebAssembly, and several PDF paths do
    // the same. Without it those tools fail at the moment someone uses them,
    // which is the worst possible time to find out. It permits WASM
    // compilation ONLY — it does not restore eval() or new Function(), which
    // is exactly the narrow hole wanted here.
    "script-src": ["'self'", "'unsafe-inline'", "'wasm-unsafe-eval'", cfInsightsScript, ...adScript],

    // Tailwind's generated styles and this app's inline style attributes (the
    // animation custom properties) both land as inline styles.
    "style-src": ["'self'", "'unsafe-inline'"],

    // data: for the generated icons and QR codes, blob: for tool output
    // previews. https: is broad on purpose and is the one place that is
    // acceptable: an image cannot execute, and ad creatives come from a very
    // long tail of hosts that cannot be enumerated.
    "img-src": ["'self'", "data:", "blob:", "https:"],

    // next/font self-hosts everything at build time, so there is genuinely no
    // external font origin to allow.
    "font-src": ["'self'", "data:"],

    // 'self' covers /api/*. The signaling socket is the one cross-origin
    // destination the product cannot work without. WebRTC's own STUN/TURN
    // traffic is not governed by connect-src in any current browser, so the
    // relay needs no entry here.
    "connect-src": ["'self'", signalingOrigin, ocrLangData, cfInsightsBeacon, ...adConnect],

    // The file-sink worker is same-origin; tesseract.js spawns its workers
    // from blob URLs.
    "worker-src": ["'self'", "blob:"],

    // Nothing here embeds anything except ad iframes.
    "frame-src": adFrame.length > 0 ? adFrame : ["'none'"],

    // No plugins, ever.
    "object-src": ["'none'"],

    // Stops an injected <base> silently repointing every relative URL on the
    // page — including the script tags — at an attacker's host.
    "base-uri": ["'none'"],

    // Nothing on this site posts a form anywhere, least of all off-origin.
    "form-action": ["'self'"],

    // The modern equivalent of the X-Frame-Options header alongside it, kept
    // because that header is still what older browsers read.
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives)
    .map(([name, values]) => `${name} ${values.join(" ")}`)
    .join("; ");

  return `${policy}; upgrade-insecure-requests`;
}

const nextConfig: NextConfig = {
  // Where the build output goes. Normally .next, but a deploy overrides it so
  // the new build lands somewhere else entirely and the running server keeps
  // serving the old one untouched. Building in place overwrote .next while the
  // live process was still reading from it, which for the length of a build
  // meant requests for chunks that had just been deleted. The deploy script
  // swaps the finished directory into place with a rename instead.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  turbopack: {
    // Pin the workspace root so Turbopack doesn't get confused by an
    // unrelated package-lock.json sitting in the parent (home) directory.
    root: __dirname,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy() },
          // Tells the browser to refuse plain HTTP for this domain from now on.
          //
          // Without it, the very first request a person makes — typing
          // "sharefilesfree.com" into the bar, which is http:// by default —
          // is a plaintext round trip that anyone on the same café wifi can
          // intercept and answer themselves, keeping the victim on http and
          // proxying the site. The 301 to https that exists today only helps
          // if that first response is not tampered with, and on a hostile
          // network it is precisely what gets tampered with.
          //
          // includeSubDomains covers signal.sharefilesfree.com, which carries
          // the signaling socket, and is safe because nothing here is served
          // over plain HTTP at any name.
          //
          // Deliberately no `preload`. That ships the domain into a list baked
          // into browser binaries, and removal takes months — it is a one-way
          // door that should be walked through on purpose, not acquired as a
          // side effect of a security pass. A year of max-age gets the
          // protection for everyone who has visited once.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          // Stops the browser from guessing content types (e.g. treating an
          // uploaded file as executable HTML/JS if a mime type is wrong).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No third-party site should be able to iframe this app (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Don't leak the full URL (which can contain a shared-link token) to
          // external sites when a user clicks an outbound link from this app.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // We don't use any of these browser features; explicitly disabling
          // them costs nothing and shrinks the attack surface a little.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // The Content-Security-Policy above is built by contentSecurityPolicy();
          // see that function for what it does and does not buy.
        ],
      },
    ];
  },
};

export default nextConfig;
