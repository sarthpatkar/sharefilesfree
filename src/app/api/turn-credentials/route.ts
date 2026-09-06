// Issues short-lived TURN credentials on demand, using Cloudflare's managed
// Realtime TURN service (1,000 GB/month free, then $0.05/GB) instead of a
// self-hosted coturn box — this removes an entire VPS-sizing/ops concern
// (opening a wide UDP port range, running Docker, etc.) for free at our
// scale. See DEPLOYMENT.md for how to create the TURN key in the dashboard.
//
// Why credentials are minted per-request server-side rather than shipped as
// a NEXT_PUBLIC_* constant: any NEXT_PUBLIC_ env var is visible to every
// visitor's browser. A permanent, hardcoded TURN credential in public JS
// would let anyone relay unlimited traffic at our expense — exactly the
// kind of free-anonymous-service abuse this plan calls out as a risk (see
// the Firefox Send case study). Cloudflare's API mints a fresh,
// short-lived credential per call instead.
import { NextResponse } from "next/server";
import { isRateLimited, clientIpFromHeaders } from "@/lib/rateLimit";

const TTL_SECONDS = 10 * 60; // credential is valid for 10 minutes — plenty to complete ICE negotiation

// How long a minted credential is reused before going back to Cloudflare.
//
// This endpoint sits directly in front of `new RTCPeerConnection()` on BOTH
// peers — peerTransfer.ts awaits it before the connection object even exists —
// so its latency is added to every single transfer, twice. Measured against the
// live deployment it was 0.43-1.24s typically, with an observed 21.9s outlier.
// A 22-second stall there is indistinguishable from the product being broken.
//
// Cloudflare's credential is valid for TTL_SECONDS and is not bound to a
// session, so there is nothing gained by minting a fresh one per visitor. Doing
// it once per window turns a per-transfer round trip to a third party into a
// process-local read, and removes Cloudflare's API from the hot path of almost
// every connection.
//
// Held well short of the TTL so a credential handed out at the last moment
// still has minutes of validity left when ICE actually uses it.
const REUSE_WINDOW_MS = (TTL_SECONDS - 240) * 1000;

// Cloudflare's API is a third party in a path that must not hang. Without this
// a slow response upstream blocks the peer connection from ever being created,
// which is strictly worse than having no TURN at all — STUN alone still
// connects the large majority of peers.
const UPSTREAM_TIMEOUT_MS = 3000;

interface CachedCredential {
  iceServers: RTCIceServer[];
  mintedAt: number;
}

let cached: CachedCredential | null = null;
/** In-flight mint, so a burst of concurrent misses makes one upstream call, not many. */
let inFlight: Promise<CachedCredential | null> | null = null;

async function mint(keyId: string, apiToken: string): Promise<CachedCredential | null> {
  try {
    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
    if (!res.ok) return null;
    const { iceServers } = (await res.json()) as { iceServers: RTCIceServer[] };
    if (!Array.isArray(iceServers) || iceServers.length === 0) return null;
    return { iceServers, mintedAt: Date.now() };
  } catch {
    // Timeout, network failure, or a malformed response. All handled the same
    // way by the caller: fall back to STUN rather than block the transfer.
    return null;
  }
}

export async function GET(request: Request) {
  const keyId = process.env.CLOUDFLARE_TURN_KEY_ID;
  const apiToken = process.env.CLOUDFLARE_TURN_API_TOKEN;

  // TURN isn't configured yet (e.g. local dev) — fall back to STUN-only.
  // Most connections work fine without TURN; only strict NATs need it.
  if (!keyId || !apiToken) {
    return NextResponse.json({ turnConfigured: false });
  }

  if (isRateLimited(clientIpFromHeaders(request.headers), 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  if (cached && Date.now() - cached.mintedAt < REUSE_WINDOW_MS) {
    return jsonWithCacheHeaders(cached);
  }

  inFlight ??= mint(keyId, apiToken).finally(() => {
    inFlight = null;
  });
  const fresh = await inFlight;

  if (fresh) {
    cached = fresh;
    return jsonWithCacheHeaders(fresh);
  }

  // Serving a stale-but-still-valid credential beats failing: it may have
  // minutes left, and STUN-only is the fallback either way.
  if (cached && Date.now() - cached.mintedAt < TTL_SECONDS * 1000) {
    return jsonWithCacheHeaders(cached);
  }

  // Fail soft — the caller falls back to STUN-only rather than blocking the whole transfer.
  return NextResponse.json({ turnConfigured: false });
}

/**
 * Lets the browser reuse the credential for the rest of its life without asking
 * again. Deliberately `private`: this is a shared credential and must never be
 * held by Cloudflare's edge cache, only by the one browser that asked.
 */
function jsonWithCacheHeaders(credential: CachedCredential) {
  const ageMs = Date.now() - credential.mintedAt;
  const remainingSeconds = Math.max(0, Math.floor((REUSE_WINDOW_MS - ageMs) / 1000));
  return NextResponse.json(
    { turnConfigured: true, iceServers: credential.iceServers },
    { headers: { "Cache-Control": `private, max-age=${remainingSeconds}` } },
  );
}
