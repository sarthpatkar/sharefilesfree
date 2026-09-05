# ShareFilesFree

Fast, free, peer-to-peer file sharing in the browser. No login, no signup, no app install. See `/Users/sarth/.claude/plans/mutable-snuggling-flamingo.md` (or ask Claude) for the full product/architecture plan this was built from.

## How it works

1. The sender picks a file and gets a 6-digit code (like Send Anywhere).
2. The receiver enters the code (or opens the QR/link, which carries the code in the URL fragment).
3. A tiny **signaling server** (`/server`) introduces the two browsers to each other and then gets out of the way.
4. Files stream **directly between browsers** over a WebRTC data channel — encrypted, no server storage, no size limit.
5. If a direct connection can't be established (strict NAT/firewall), traffic falls back to a **TURN relay** — same idea as Send Anywhere's cloud relay fallback. This uses Cloudflare's managed Realtime TURN service (free up to 1,000 GB/month) rather than self-hosting one.
6. If the receiver isn't online yet, the code keeps working for **an hour** while the sender leaves the tab open — the file waits on the sender's own device, never on ours. There is deliberately no upload-and-share-a-link fallback; see "No storage, on purpose" below.
7. A **Tools** section offers a full PDF/Office utility suite — merge, split, organize, compress, watermark, page numbers, conversions to/from Word/Excel/PowerPoint/Markdown, plus image tools, a QR generator, and OCR — running **entirely client-side**, no upload, no server cost. Every tool lives on its **own indexable URL** (`/tools/merge-pdf`, etc.) for real SEO, not just hidden behind an in-app tab. Most tools support batch processing (multiple files in, one zip out) with a progress bar. A result can be downloaded directly or handed straight to the Send tab.
8. The site works **offline after a first visit** via a small hand-rolled service worker (cache-as-you-go) — the Tools are 100% client-side already, so this makes them usable with no internet at all once cached.

## No storage, on purpose

This service stores no files. Not briefly, not encrypted, not at all. There is
no bucket, no upload endpoint, and no page that serves user content.

That started as a legal decision and turned out to be a product one. An
anonymous host that keeps files carries the whole weight of intermediary law —
takedown clocks measured in hours, a duty to preserve removed content for 180
days, copyright notices, and the exposure that comes with holding material you
can read. A service that transmits and forgets carries almost none of it: there
is nothing to take down, nothing to preserve, and nothing to hand over.

It is also the only version of "no limits, free forever" that is actually true.
A transfer that never touches our machines costs us nothing however big it is,
so there is no size to cap and no retention to ration.

The cost is real and stated plainly on the site: **both devices have to be open
at the same time.** If that changes — a company behind it, users, revenue — the
storage path is recoverable from git history (branch `ads-and-storage-policy`,
through commit `7ae4989`), where it sits complete with multipart upload, a
retention ladder priced on bytes x time, password protection, one-time links
and abuse reporting. Read that history before rebuilding it; register the
company before shipping it.

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

Open `http://localhost:3000` in two different browser tabs (or two devices on the same network) to test a transfer end-to-end. TURN is optional locally — without it, direct P2P works fine on a normal home network.

## Testing

```bash
npm test              # unit tests (Vitest) — pure logic: hashing, rate limiting, formatting, sanitization
cd server && npm test  # signaling protocol integration test (needs the server running — see its comment header)
```

Both run automatically on every push via GitHub Actions (`.github/workflows/ci.yml`), alongside `npm run lint` and `npm run build`.

## Deploying

**See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full step-by-step runbook** — buying a domain, setting up a free Google Cloud VM, DNS, TURN, and AdSense. Short version: the Next.js site + signaling server run on one free-tier Google Cloud `e2-micro` instance behind Caddy for free automatic HTTPS, with Cloudflare providing managed TURN relay (free at this scale) — no self-hosted TURN relay to run or pay for, and no storage bill at all.

### Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SIGNALING_URL` | frontend | `ws://`/`wss://` address of `/server` |
| `CLOUDFLARE_TURN_KEY_ID`, `CLOUDFLARE_TURN_API_TOKEN` | frontend (server-side only, **no** `NEXT_PUBLIC_` prefix) | Cloudflare Realtime TURN key, used to mint short-lived credentials per session |
| `NEXT_PUBLIC_AD_CLIENT` | frontend (public) | AdSense publisher id. Unset = no ad script, no slots, no gates |
| `NEXT_PUBLIC_AD_HOUSE` | frontend (public) | `1` draws labelled placeholders instead of real ads, for reviewing layout before an ad account exists |

See `.env.local.example` for the full annotated list.

### Ads

Ads are the only revenue path — no login, no paywall, no direct charges — so
they are part of the architecture rather than something sprinkled on at the end.
Two mechanisms, and a rule about where each may appear.

**Banner slots** (`<AdSlot>`) reserve their height before anything loads and
don't fetch the ad script until they're near the viewport. Both properties are
load-bearing: an ad arriving into unreserved space shifts the layout, layout
shift moves Core Web Vitals, and Core Web Vitals move the search ranking that
brings the tool traffic these ads are sold against.

**Gates** (`<AdGate>`) put five seconds between an action and its result, on the
two moments where the user is already waiting: revealing a code, and connecting
as receiver. They are client-side, and honestly so — the service stores nothing,
so there is no cost to protect behind them, only revenue to earn, and a server
round trip to verify a five-second timer would buy nothing. (An earlier version
signed a server receipt because the thing behind the gate was an upload we paid
to store; that path is gone.)

**An ad is never longer than the wait it plays over.** Five seconds is what fits
in front of a connection that takes a second or two; anything longer would be
manufacturing friction rather than filling it.

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
  earns. There is deliberately no site-wide unit in the root layout either —
  one slot per page keeps ad density well under the threshold those standards
  care about.
- **Nobody is ever blocked.** If no ad can be served — blocker, no fill,
  offline — the wait still runs (otherwise the gate is decoration) but the user
  always gets through, and any failure in our own ad plumbing passes them
  straight on.
- **Every gate is the same five seconds.** There is no ladder any more: with no
  storage, no action costs more to serve than any other, so nothing justifies
  asking one person for longer than another. (The cost-scaled version, which
  priced ads against bytes x time, is in git history with the storage path.)

## Project layout

```
src/
  app/
    page.tsx                 Home (/, send tab default)
    receive/page.tsx         /receive#123456 — deep link into the receive tab
    privacy/, terms/         Legal pages (linked in the footer + sitemap)
    not-found.tsx, error.tsx  Branded 404 / error boundaries
    icon.tsx, apple-icon.tsx, opengraph-image.tsx, manifest.ts  Generated in code — no design tool needed
    robots.ts, sitemap.ts    SEO metadata routes
    api/
      turn-credentials/      Mints short-lived TURN credentials (see comments in route.ts) — the only API route
  components/     UI: SendPanel, ReceivePanel, CodeDisplay, ProgressBar, ToolsPanel, Button, icons.tsx, Home
    ads/            AdSlot (reserved-space banner), AdGate (the five-second gate), adNetwork.ts (the one file that knows about AdSense)
    tools/          Per-tool UI — 14 tools, see the Tools table above; most use the shared SimpleConversionTool
                    shell (FileDropZone → options → ToolResultCard), Organize/Split have bespoke thumbnail UIs
  lib/
    peerTransfer.ts   Core WebRTC signaling + chunked file transfer engine, with retry-with-backoff on connect (no UI deps)
    ads.ts            Ad policy: where gates appear, how long they run, banner sizes
    rateLimit.ts      In-memory per-IP throttle for the TURN-credential route
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
DEPLOYMENT.md    Full step-by-step deployment runbook (domain → VPS → DNS → TURN → AdSense)
```

### A couple of dependency notes worth knowing about

- **`xlsx`** is installed from SheetJS's own CDN (`https://cdn.sheetjs.com/...`), not the npm registry — the npm-published version has known unpatched vulnerabilities (prototype pollution, ReDoS) that SheetJS fixes only in their own distribution.
- **`pptxgenjs`**'s `image-size` dependency has an open DoS advisory (infinite loop on malformed ICNS/JXL/HEIF files) with no fix released yet. Checked and confirmed: `image-size` never appears in pptxgenjs's browser bundle at all (it's a Node.js-only code path), so this app's client-side usage never reaches the vulnerable code — worth re-checking on any pptxgenjs upgrade.
