# ShareFilesFree

Fast, free, peer-to-peer file sharing in the browser. No login, no signup, no app install. See `/Users/sarth/.claude/plans/mutable-snuggling-flamingo.md` (or ask Claude) for the full product/architecture plan this was built from.

## How it works

1. The sender picks a file and gets a 6-digit code (like Send Anywhere).
2. The receiver enters the code (or opens a shared link).
3. A tiny **signaling server** (`/server`) introduces the two browsers to each other and then gets out of the way.
4. Files stream **directly between browsers** over a WebRTC data channel — encrypted, no server storage, no size limit.
5. If a direct connection can't be established (strict NAT/firewall), traffic falls back to a **TURN relay** — same idea as Send Anywhere's cloud relay fallback. This uses Cloudflare's managed Realtime TURN service (free up to 1,000 GB/month) rather than self-hosting one.
6. If the receiver isn't online at all, the sender can switch to **"share a link instead"** — the file uploads once to Cloudflare R2, and the link works anytime until it expires (like WeTransfer), without our server ever being in the download path.

Phase 1 (pure P2P) and the start of Phase 2 (the link fallback) are both built. Still to come: abuse-reporting UI and ads.

## Running it locally

You need two things running at once: the Next.js app and the signaling server.

```bash
# Terminal 1 — signaling server
cd server
npm install
npm run dev        # listens on :8080

# Terminal 2 — frontend
cp .env.local.example .env.local
npm install
npm run dev         # listens on :3000
```

Open `http://localhost:3000` in two different browser tabs (or two devices on the same network) to test a transfer end-to-end. TURN and R2 are both optional locally — without them, direct P2P (works fine on a normal home network) and the "share a link" fallback (disabled with a friendly error) respectively.

## Deploying

**See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full step-by-step runbook** — buying a domain, setting up a free Google Cloud VM, DNS, R2, TURN, and AdSense. Short version: the Next.js site + signaling server run on one free-tier Google Cloud `e2-micro` instance behind Caddy for free automatic HTTPS, with Cloudflare providing R2 storage and managed TURN relay (both free at this scale) — no self-hosted TURN relay to run or pay for.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SIGNALING_URL` | frontend | `ws://`/`wss://` address of `/server` |
| `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | frontend (server-side only, **no** `NEXT_PUBLIC_` prefix) | Cloudflare Realtime TURN key, used to mint short-lived credentials per session |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | frontend (server-side only) | Cloudflare R2 access for the link-sharing fallback |
| `MAX_UPLOAD_BYTES` | frontend | Caps worst-case storage cost per upload (default 2GB) |
| `UPLOAD_EXPIRY_HOURS` | frontend | How long a shared link stays valid (default 24h) |

See `.env.local.example` for the full annotated list.

### Setting up Cloudflare R2 (for the "share a link" fallback)

1. In the Cloudflare dashboard: **R2 → Create bucket** (e.g. `sendfilesfree-uploads`).
2. **R2 → Manage API tokens → Create API token** with Object Read & Write permissions scoped to that bucket. This gives you `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; your Account ID is shown on the R2 overview page.
3. **Important — set up auto-deletion**: on the bucket, add an **Object lifecycle rule** to expire objects after your chosen retention window (e.g. 1-2 days, matching `UPLOAD_EXPIRY_HOURS`). The app treats a link as dead once it's past `expiresAt` regardless, but the lifecycle rule is what actually deletes the bytes — without it, expired files would sit in the bucket forever and quietly rack up storage cost. This is a one-time dashboard/API setup step, not something the app code does.
4. Set the four `R2_*` env vars and redeploy.

Without R2 configured, the app still works fully P2P — the "share a link" button just isn't offered.

## Project layout

```
src/
  app/
    page.tsx                 Home (/, send tab default)
    receive/page.tsx         /receive?code=123456 — deep link into the receive tab
    download/[token]/page.tsx  Link-fallback download page
    api/
      turn-credentials/      Mints short-lived TURN credentials (see comments in route.ts)
      upload-url/            Issues a presigned R2 upload URL + token for the link fallback
      file/[token]/          Looks up a shared link's metadata + a fresh presigned download URL
  components/     UI: SendPanel, ReceivePanel, CodeDisplay, LinkShare, DownloadPanel, ProgressBar, Home
  lib/
    peerTransfer.ts   Core WebRTC signaling + chunked file transfer engine (no UI deps)
    linkTransfer.ts   Browser-side upload-with-progress for the link fallback
    r2.ts             Cloudflare R2 client (presigned URLs, metadata sidecar objects)
    rateLimit.ts      Shared in-memory per-IP throttle for the upload/TURN-credential APIs
    format.ts         Byte-size formatting helper
server/
  index.js        WebSocket signaling server (pairs sender/receiver by room code, relays SDP/ICE only)
deploy/
  signaling.service  systemd unit for the signaling server
  Caddyfile.example  Reverse proxy + automatic HTTPS config
DEPLOYMENT.md    Full step-by-step deployment runbook (domain → VPS → DNS → R2 → TURN → AdSense)
```
