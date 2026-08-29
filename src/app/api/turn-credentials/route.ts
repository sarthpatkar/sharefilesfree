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

const TTL_SECONDS = 5 * 60; // credential is valid for 5 minutes — plenty to complete ICE negotiation

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

  const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${keyId}/credentials/generate-ice-servers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ttl: TTL_SECONDS }),
  });

  if (!res.ok) {
    // Fail soft — the caller falls back to STUN-only rather than blocking the whole transfer.
    return NextResponse.json({ turnConfigured: false });
  }

  const { iceServers } = (await res.json()) as { iceServers: RTCIceServer[] };
  return NextResponse.json({ turnConfigured: true, iceServers });
}
