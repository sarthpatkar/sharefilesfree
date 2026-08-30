# ShareFilesFree

Fast, free, peer-to-peer file sharing in the browser. No login, no signup, no app install. See `/Users/sarth/.claude/plans/mutable-snuggling-flamingo.md` (or ask Claude) for the full product/architecture plan this was built from.

## How it works

1. The sender picks a file and gets a 6-digit code (like Send Anywhere).
2. The receiver enters the code (or opens a shared link).
3. A tiny **signaling server** (`/server`) introduces the two browsers to each other and then gets out of the way.
4. Files stream **directly between browsers** over a WebRTC data channel — encrypted, no server storage, no size limit.
5. If a direct connection can't be established (strict NAT/firewall), traffic falls back to a **TURN relay** — same idea as Send Anywhere's cloud relay fallback. This uses Cloudflare's managed Realtime TURN service (free up to 1,000 GB/month) rather than self-hosting one.
6. If the receiver isn't online at all, the sender can switch to **"share a link instead"** — the file uploads once to Cloudflare R2, and the link works anytime until it expires (like WeTransfer), without our server ever being in the download path. This link can optionally be **password protected**, set to **delete after first download**, and given a custom expiry (1 hour to 7 days) — matching what competitors (Smash, WeTransfer, Send Anywhere) offer.
7. Every download page has a **"Report this file"** link that immediately disables the shared link — no review queue, no waiting on the operator.
8. A **Tools** tab offers a full PDF/Office utility suite — merge, split, organize, compress, watermark, page numbers, and conversions to/from Word, Excel, PowerPoint, and Markdown — running **entirely client-side**. No upload, no server cost, works even before picking a transfer method. A result can be downloaded directly or handed straight to the Send tab.

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
| `MAX_UPLOAD_BYTES` | frontend | Caps worst-case storage cost per upload (default 2GB) |
| `UPLOAD_EXPIRY_HOURS` | frontend | Ceiling on how long a shared link can stay valid — the sender picks 1h/1d/3d/7d, capped at this (default 168h/7 days) |

See `.env.local.example` for the full annotated list.

### Setting up Cloudflare R2 (for the "share a link" fallback)

1. In the Cloudflare dashboard: **R2 → Create bucket** (e.g. `sendfilesfree-uploads`).
2. **R2 → Manage API tokens → Create API token** with Object Read & Write permissions scoped to that bucket. This gives you `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`; your Account ID is shown on the R2 overview page.
3. **Important — set up auto-deletion**: on the bucket, add an **Object lifecycle rule** to expire objects after your `UPLOAD_EXPIRY_HOURS` ceiling (default 7 days) — **not shorter**, since senders can pick up to that long a retention window per file, and a tighter lifecycle rule would delete files out from under a link before its stated expiry. The app treats a link as dead once it's past its own `expiresAt` regardless, but the lifecycle rule is what actually deletes the bytes — without it, expired files would sit in the bucket forever and quietly rack up storage cost. This is a one-time dashboard/API setup step, not something the app code does.
4. Set the four `R2_*` env vars and redeploy.

Without R2 configured, the app still works fully P2P — the "share a link" button just isn't offered.

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
