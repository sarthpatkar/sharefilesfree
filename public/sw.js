// Minimal hand-rolled service worker — no build plugin, no precache manifest
// to keep in sync with Next.js's hashed chunk names.
//
// The previous version was cache-first for EVERYTHING same-origin, which broke
// in a way that is worth writing down, because it looks like a React bug and
// isn't:
//
//   1. A visit cached the HTML document and the JS chunks it referenced.
//   2. A deploy went out.
//   3. The next visit was served the cached JS — an old build — while the HTML
//      came from the new one. React hydrated a tree built by old component code
//      against markup rendered by new component code and reported a hydration
//      mismatch, pointing at whichever element happened to differ first.
//
// The old version was also permanently one deploy behind by design: it returned
// the cached response and only used the network result to refresh the cache for
// next time, so a user could never see the current site.
//
// The rule that avoids all of this: only serve something from cache first if
// its URL changes whenever its content changes. That is true of /_next/static/,
// where the build hash is in the filename, and false of everything else.
//
// Bumped to v2 so activate() deletes any cache poisoned by the old strategy.
const CACHE_NAME = "sharefilesfree-v2";

// Never cache anything that must stay live: APIs, and the transfer/download
// flows, which are inherently online-only (P2P signaling, R2-backed links).
const NEVER_CACHE_PREFIXES = ["/api/", "/download/", "/receive"];

/**
 * Content-hashed build output. The filename contains the build hash, so a given
 * URL's bytes can never change — safe to serve from cache indefinitely, and the
 * only category where cache-first is correct rather than merely fast.
 */
function isImmutableAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Cache-first. Only ever used for immutable, content-hashed URLs. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/**
 * Network-first, cache as the offline fallback. Used for documents: a page must
 * reflect the deploy that is live now, and must reference the chunk URLs that
 * exist now. Falling back to cache only when the network fails is what keeps
 * the offline story without the staleness.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw err;
  }
}

/**
 * Serve the cached copy immediately and refresh it in the background. Right for
 * things whose URL is stable but whose content may change and where being one
 * visit behind is harmless — icons, images, files under /public.
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (NEVER_CACHE_PREFIXES.some((p) => url.pathname.startsWith(p))) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
