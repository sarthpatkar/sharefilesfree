# ShareFilesFree

Fast, free, peer-to-peer file sharing in the browser. No login, no signup, no app install. See `/Users/sarth/.claude/plans/mutable-snuggling-flamingo.md` (or ask Claude) for the full product/architecture plan this was built from.

## How it works

1. The sender picks a file and gets a 6-digit code (like Send Anywhere).
2. The receiver enters the code (or opens a shared link).
3. A tiny **signaling server** (`/server`) introduces the two browsers to each other and then gets out of the way.
4. Files stream **directly between browsers** over a WebRTC data channel — encrypted, no server storage, no size limit.
5. If a direct connection can't be established (strict NAT/firewall), traffic falls back to a **TURN relay** — same idea as Send Anywhere's cloud relay fallback. This uses Cloudflare's managed Realtime TURN service (free up to 1,000 GB/month) rather than self-hosting one.
6. If the receiver isn't online at all, the sender can switch to **"share a link instead"** — the file uploads once to Cloudflare R2, and the link works anytime until it expires (like WeTransfer), without our server ever being in the download path. This link can optionally be **password protected**, set to **delete after first download**, and given a custom expiry (1 hour to 7 days) — matching what competitors (Smash, WeTransfer, Send Anywhere) offer. Files over 10MB use **resumable multipart upload** (a dropped connection only costs the failed part, not the whole file). Multiple files can be shared via one link too, but **only if you explicitly opt in** to bundling them into a `.zip` first — never automatic.
7. Every download page has a **"Report this file"** link that immediately disables the shared link — no review queue, no waiting on the operator.
8. A **Tools** section offers a full PDF/Office utility suite — merge, split, organize, compress, watermark, page numbers, conversions to/from Word/Excel/PowerPoint/Markdown, plus image tools, a QR generator, and OCR — running **entirely client-side**, no upload, no server cost. Every tool lives on its **own indexable URL** (`/tools/merge-pdf`, etc.) for real SEO, not just hidden behind an in-app tab. Most tools support batch processing (multiple files in, one zip out) with a progress bar. A result can be downloaded directly or handed straight to the Send tab.
9. The site works **offline after a first visit** via a small hand-rolled service worker (cache-as-you-go) — the Tools are 100% client-side already, so this makes them usable with no internet at all once cached.

Phase 1 (pure P2P) and Phase 2 (the link fallback, abuse reporting) are both built. Still to come: malware scanning on the relay path and ads.

## Tools (client-side compress/convert)

All under `src/lib/tools/` (pure logic, browser APIs only) + `src/components/tools/` (UI). Every tool runs in the visitor's own browser — files never leave it for these operations, and it costs us nothing regardless of usage volume.

| Tool | How | Notes |
|---|---|---|
| Merge PDF | `pdf-lib` | Reorderable before merging |
| Split PDF | `pdf-lib` + `pdfjs-dist` (thumbnails) | Extract a range, or every page as a `.zip` |
| Organize PDF | `pdf-lib` + `pdfjs-dist` | Reorder, rotate, delete pages via a thumbnail grid |
| Compress PDF | `pdf-lib` (light) / `pdfjs-dist` rasterize (strong) | "Light" is lossless (~5-20% typical); "strong" rasterizes pages to JPEG for much bigger savings on image-heavy PDFs, **at the cost of selectable/searchable text** — stated plainly in the UI, not hidden |
| Watermark | `pdf-lib` | Configurable text, opacity, size, rotation |
| Page numbers | `pdf-lib` | 6 positions, custom start number |
| Images → PDF | `pdf-lib` | One page per image |
| Word → PDF | `mammoth` + `jspdf` (html2canvas) | Good for straightforward documents; very complex layouts may not paginate perfectly |
| Excel → PDF | `xlsx` (SheetJS) + `jspdf-autotable` | One page per sheet |
| PDF → PowerPoint | `pdfjs-dist` + `pptxgenjs` | Each page becomes a slide **image** — visually accurate, not editable text (no reliable client-side engine reconstructs editable slides from a PDF) |
| PDF → Word | `pdfjs-dist` + `docx` | Labeled "basic" in the UI: recovers text with rough heading detection, **not layout/columns/images** |
| PDF → Excel | `pdfjs-dist` + `xlsx` | Labeled "basic": text-per-line extraction, **not real table/column detection** (a PDF has no concept of cells) |
| PDF → Markdown | `pdfjs-dist` | Headings/bullets guessed from font size — works well on simply-formatted docs |
| Compress image | Canvas API | JPEG/WebP/PNG output; honestly reports when a file doesn't shrink instead of showing a false "smaller" badge |

**Deliberately not built** — see the plan file for the full reasoning:
- **HTML → PDF (URL to PDF)**: requires fetching and rendering an arbitrary live webpage, which needs a real server-side headless browser (cost + CORS make this impossible client-side). Revisit once real infra exists.
- **PDF → PDF/A**: no client-side library actually produces ISO 19005-compliant output; shipping a fake "PDF/A" would be dishonest.
- **PowerPoint → PDF**: no reliable pure-JS PPTX rendering engine exists; a broken/inaccurate result would be worse than not offering it. The real fix, once server infra exists, is running LibreOffice headless — a well-established technique, not a hack.

Verified end-to-end with a real headless browser (Playwright, temporary — not a project dependency) driving actual file uploads through all 14 tools plus the send-handoff. One honest limitation of that verification: Chromium's headless mode can't hand back `blob:`-URL download bytes to test tooling (a known Playwright/Chromium limitation, confirmed — not a product issue), so verification confirms every tool completes without error and produces a correctly-named/typed file with no console errors, rather than byte-for-byte output inspection for every format.

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

## Testing

```bash
npm test              # unit tests (Vitest) — pure logic: hashing, rate limiting, formatting, sanitization
cd server && npm test  # signaling protocol integration test (needs the server running — see its comment header)
```

Both run automatically on every push via GitHub Actions (`.github/workflows/ci.yml`), alongside `npm run lint` and `npm run build`.

## Deploying

**See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full step-by-step runbook** — buying a domain, setting up a free Google Cloud VM, DNS, R2, TURN, and AdSense. Short version: the Next.js site + signaling server run on one free-tier Google Cloud `e2-micro` instance behind Caddy for free automatic HTTPS, with Cloudflare providing R2 storage and managed TURN relay (both free at this scale) — no self-hosted TURN relay to run or pay for.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SIGNALING_URL` | frontend | `ws://`/`wss://` address of `/server` |
| `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | frontend (server-side only, **no** `NEXT_PUBLIC_` prefix) | Cloudflare Realtime TURN key, used to mint short-lived credentials per session |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` | frontend (server-side only) | Cloudflare R2 access for the link-sharing fallback |
| `MAX_UPLOAD_BYTES` | frontend | Lowers the link path's size ceiling below the retention ladder's own top tier (default 50GB) |
| `UPLOAD_EXPIRY_HOURS` | frontend | Optional hard ceiling on retention for *every* file, applied on top of the ladder. Unset = the ladder decides |
| `NEXT_PUBLIC_AD_CLIENT` | frontend (public) | AdSense publisher id. Unset = no ad script, no slots, no gates |
| `NEXT_PUBLIC_AD_HOUSE` | frontend (public) | `1` draws labelled placeholders instead of real ads, for reviewing layout before an ad account exists |

See `.env.local.example` for the full annotated list.

### Link size and retention

R2 bills bytes × time, so size alone is the wrong thing to ration — a 50GB file
kept six hours costs less than a 2GB file kept a week. The link path therefore
has a generous size ceiling and a window that narrows as the file grows
(`src/lib/retention.ts`):

| File size | Window it comes with | Costs us | Longest it can be bought up to |
|---|---|---|---|
| up to 2GB | 7 days | $0.0069 | — (already the maximum) |
| up to 10GB | 24 hours | $0.0049 | 7 days, for 4 ads |
| up to 50GB | 6 hours | $0.0062 | ~38 hours; 24h for 3 ads |

The base tiers are deliberately within a rounding error of each other, which is
the property to preserve if the numbers ever change: no tier should be
dramatically more expensive to serve than another, because each is priced at
about one ad.

**Longer windows are bought with attention.** Past the window a file comes with,
the sender can trade extra ad views for extra hours — which is the loop the
whole business rests on, aimed at the axis that actually costs money. The
ceiling on what's purchasable is derived, not chosen: `maxPurchasableHours()`
is the longest window whose storage cost is covered by the maximum ads a single
action may ask for (`MAX_RECOVERABLE_USD` in `lib/ads.ts`), so the site can
never be talked into storing more than it earns. With no ad network configured
there is nothing to buy hours with, so the base ladder is the whole story.

A request for longer than is purchasable is clamped down rather than refused,
the send UI builds its menu and its per-option ad prices from the same modules,
and `/api/upload-url` re-derives both — so what's offered, what's charged, and
what's enforced cannot drift apart.

The size is enforced by signing `ContentLength` into the presigned PUT (and
into each multipart part's URL), so it's a limit rather than a claim the
browser makes about itself. Part size scales with the file — a 50GB upload is
~1,000 parts of ~52MB rather than 6,400 of 8MB, which keeps it inside
`/api/upload-part-url`'s rate limit.

**Files over 2GB are always one-time links**, whether or not the sender ticks
the box. This is the control that makes a 50GB ceiling survivable: distributing
pirated or malicious material needs one file and many downloaders, and a link
that dies on first use has none — while remaining exactly right for what large
files are actually sent for. It costs a legitimate sender nothing and a
distributor everything.

**Uploads are also rate-limited by gigabytes, not just by count.** Ten uploads
an hour was a fine ceiling at a 2GB cap; at 50GB the same ten are half a
terabyte an hour from one connection. `/api/upload-url` now charges each
authorised upload against a per-IP byte budget (20GB/hour).

**Delete after first download** really deletes: the object and its metadata
sidecar are removed an hour after the download URL is handed out. The hour is
grace for a slow connection, since a download that starts inside the URL's
five-minute window can legitimately run much longer. The timer lives in the
process, so a restart inside that hour falls back to a sweep on next access and
then to the bucket lifecycle rule — the same place every burned file used to
end up.

### Ads

Ads are the only revenue path — no login, no paywall, no direct charges — so
they are part of the architecture rather than something sprinkled on at the end.
Two mechanisms, and a rule about where each may appear.

**Banner slots** (`<AdSlot>`) reserve their height before anything loads and
don't fetch the ad script until they're near the viewport. Both properties are
load-bearing: an ad arriving into unreserved space shifts the layout, layout
shift moves Core Web Vitals, and Core Web Vitals move the search ranking that
brings the tool traffic these ads are sold against.

**Gates** (`<AdGate>`) put a few seconds between an action and its result. They
appear only on the transfer flow (revealing a code, connecting as receiver) and
on uploading to the link path. **Never on the download page** — that is the only
page showing content we did not write and cannot vet, and running ads beside
material that turns out to be infringing is a well-worn way to lose an ad
account, taking the tools' revenue with it. The gate on `/api/upload-url` is
enforced *server-side* against a one-use receipt that is priced for a specific
size and retention (`lib/adGate.ts`) — a gate that lived only in the browser
would be skipped by exactly the people worth gating.

**An ad is never longer than the upload it plays over.** Fifteen seconds during
a 2GB upload is free — the upload takes minutes and the ad hides inside it. The
same fifteen seconds on a 5MB file turns a three-second action into a
fifteen-second one, which manufactures friction rather than filling it. So
uploads under 5MB are not gated at all, uploads under 50MB get the short ad, and
only files big enough to hide a rewarded video behind get one.

**Tool pages carry banners only, never a gate.** Nothing stands between a
visitor and using a tool or saving its result. That's a product rule: the tools
promise "no queue, no watermark, no daily limit", and they're the best ad
inventory on the site precisely because they're frictionless. Ads pay for the
tools; they don't tax them.

Three constraints worth knowing before changing any of this:

- **Gates are user-initiated and render in flow, never as a full-screen
  countdown on page load.** A "prestitial with countdown" is on the Coalition
  for Better Ads disallowed list for mobile web, and repeat violations get ads
  blocked across the whole site by Chrome — which costs far more than any unit
  earns. Same reason the site-wide footer unit is in normal flow rather than
  stuck to the bottom of the viewport.
- **Nobody is ever blocked.** If no ad can be served — blocker, no fill,
  offline — the wait still runs (otherwise the gate is decoration) but the user
  always gets through, and any failure in our own ad plumbing passes them
  straight on.
- **Ad load on the link path scales with bytes × time, not bytes**, because
  that's what R2 actually bills. A 40GB file kept six hours costs one ad; the
  same file kept a week costs four. Tune the whole ladder from
  `USD_RECOVERED_PER_AD` in `lib/ads.ts`.

### Setting up Cloudflare R2 (for the "share a link" fallback)

1. In the Cloudflare dashboard: **R2 → Create bucket** (e.g. `sendfilesfree-uploads`).
2. **R2 → Manage API tokens → Create API token** with Object Read & Write permissions scoped to that bucket. This gives you `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; your Account ID is shown on the R2 overview page.
3. **Important — set up auto-deletion**: on the bucket, add an **Object lifecycle rule** to expire objects after **7 days** — **not shorter**, since that's the longest window the retention ladder grants any file (a small one), and a tighter rule would delete files out from under a link before its stated expiry. The app treats a link as dead once it's past its own `expiresAt` regardless, but the lifecycle rule is what actually deletes the bytes — without it, expired files would sit in the bucket forever and quietly rack up storage cost. This is a one-time dashboard/API setup step, not something the app code does.
4. **Required for large-file (multipart) uploads to work — set the bucket's CORS policy** to expose the `ETag` header, or every multipart upload will fail at the "complete" step with a CORS error. In the bucket's Settings → CORS Policy, add:
   ```json
   [
     {
       "AllowedOrigins": ["https://sharefilesfree.com"],
       "AllowedMethods": ["PUT"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"]
     }
   ]
   ```
   Without `ExposeHeaders: ["ETag"]`, the browser's XHR can't read the ETag each part upload needs to report back — R2 accepts the upload but our client-side code can't complete it. **This specific requirement has not been tested against a live R2 bucket** (none exists yet in development) — verify it once real infra is up; the multipart logic itself (`src/lib/r2.ts`, `src/lib/linkTransfer.ts`) follows the standard S3-compatible multipart API and was reviewed carefully, but flagging this honestly rather than claiming full verification it didn't get.
5. Set the four `R2_*` env vars and redeploy.

Without R2 configured, the app still works fully P2P — the "share a link" button just isn't offered.

### A note on large-file uploads (resumable within a session)

Files over 10MB use R2/S3's multipart upload API instead of a single PUT — each ~8MB part uploads (and retries, up to 4 times with backoff) independently, so a dropped connection only costs the one failed part, not the whole file. **Scope**: this recovers from a mid-session network blip, not a fully closed tab reopened days later (that would need persisting the upload ID and re-selecting the identical file from disk — a materially bigger feature, not attempted here).

## Project layout

```
src/
  app/
    page.tsx                 Home (/, send tab default)
    receive/page.tsx         /receive?code=123456 — deep link into the receive tab
    download/[token]/page.tsx  Link-fallback download page
    privacy/, terms/         Legal pages (linked in the footer + sitemap)
    not-found.tsx, error.tsx  Branded 404 / error boundaries
    icon.tsx, apple-icon.tsx, opengraph-image.tsx, manifest.ts  Generated in code — no design tool needed
    robots.ts, sitemap.ts    SEO metadata routes
    api/
      turn-credentials/      Mints short-lived TURN credentials (see comments in route.ts)
      upload-url/            Issues a presigned R2 upload URL + token for the link fallback
      file/[token]/          Looks up a shared link's metadata + a fresh presigned download URL (or {requiresPassword:true})
      file/[token]/unlock/   Verifies a password-protected link's password before releasing the download URL
      report/[token]/        Abuse report — immediately disables a shared link
  components/     UI: SendPanel, ReceivePanel, CodeDisplay, LinkShare, DownloadPanel, ProgressBar, ToolsPanel, Button, icons.tsx, Home
    tools/          Per-tool UI — 14 tools, see the Tools table above; most use the shared SimpleConversionTool
                    shell (FileDropZone → options → ToolResultCard), Organize/Split have bespoke thumbnail UIs
  lib/
    peerTransfer.ts   Core WebRTC signaling + chunked file transfer engine, with retry-with-backoff on connect (no UI deps)
    linkTransfer.ts   Browser-side upload-with-progress for the link fallback
    r2.ts             Cloudflare R2 client (presigned URLs, metadata sidecar objects, password hashing)
    rateLimit.ts      Shared in-memory per-IP throttle for the upload/TURN-credential/report/unlock APIs
    sanitize.ts       Filename sanitization (prevents header injection in Content-Disposition)
    format.ts         Byte-size formatting helper
    tools/            All 14 conversion/compression functions — pure browser-API logic, no UI (see the Tools table above)
    *.test.ts         Vitest unit tests for the above (run: `npm test`)
scripts/
  copy-pdf-worker.mjs  Copies pdf.js's worker file into public/ on every install (see package.json's postinstall) —
                       a static file is more predictable across bundlers than bundler-specific worker-asset resolution
server/
  index.js             WebSocket signaling server (pairs sender/receiver by room code, relays SDP/ICE only)
  test-signaling.mjs   Integration test for the signaling protocol (run: `npm test` from /server)
deploy/
  signaling.service  systemd unit for the signaling server
  Caddyfile.example  Reverse proxy + automatic HTTPS config
.github/workflows/ci.yml  Runs lint, build, and both test suites on every push
DEPLOYMENT.md    Full step-by-step deployment runbook (domain → VPS → DNS → R2 → TURN → AdSense)
```

### A couple of dependency notes worth knowing about

- **`xlsx`** is installed from SheetJS's own CDN (`https://cdn.sheetjs.com/...`), not the npm registry — the npm-published version has known unpatched vulnerabilities (prototype pollution, ReDoS) that SheetJS fixes only in their own distribution.
- **`pptxgenjs`**'s `image-size` dependency has an open DoS advisory (infinite loop on malformed ICNS/JXL/HEIF files) with no fix released yet. Checked and confirmed: `image-size` never appears in pptxgenjs's browser bundle at all (it's a Node.js-only code path), so this app's client-side usage never reaches the vulnerable code — worth re-checking on any pptxgenjs upgrade.
