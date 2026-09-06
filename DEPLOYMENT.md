# Deployment guide — sharefilesfree.com

**Status: live.** The site is deployed and serving. This document describes the
setup as it actually exists, what is still outstanding, and how to change it.

Last verified 5 September 2026.

---

## What is running

```
Cloudflare (DNS + proxy, all records orange/proxied)
 ├─ sharefilesfree.com          → Hostinger VPS 62.72.29.23 : Caddy → localhost:3000 (Next.js)
 ├─ www.sharefilesfree.com      → 301 redirect to the apex
 └─ signal.sharefilesfree.com   → Hostinger VPS 62.72.29.23 : Caddy → localhost:8080 (signaling)

Cloudflare R2          → NONE. This service stores no files (see below)
Cloudflare Realtime TURN → LIVE (relay allocating; verified 5 Sep 2026)
```

| | |
|---|---|
| Host | Hostinger VPS, KVM 1 — 1 vCPU, 4 GB RAM, 50 GB NVMe, India region |
| IP | `62.72.29.23` (IPv6 deliberately disabled — see gotcha 4) |
| OS | Ubuntu 26.04.1 LTS |
| Runtime | Node 24.20.0, Caddy 2.11.4 with the `caddy-dns/cloudflare` plugin |
| Certificates | Let's Encrypt production, DNS-01 challenge, auto-renewing |
| App user | `sendfilesfree` (unprivileged, no login shell use) |

### Why a VPS and not serverless

Every comparable product runs a real origin server — verified 4 Sep 2026 by DNS,
response headers and RDAP lookups: PairDrop is nginx on netcup, ToffeeShare is
nginx on a DigitalOcean droplet, Smallpdf serves `x-powered-by: Express` behind
CloudFront. Nothing in this category is serverless. Cloudflare Workers was
evaluated and remains a viable alternative, but it needs the signaling server
ported to a Durable Object and either a community adapter (`@opennextjs/cloudflare`)
or Cloudflare's `vinext`, which reimplements the Next.js API surface rather than
running Next.js itself.

---

## Access

```bash
ssh -i ~/.ssh/sharefilesfree_deploy root@62.72.29.23
```

Password authentication is disabled. That key is the only way in, besides
Hostinger's browser console. **Do not lose it.**

---

## Files on the server

| Path | What it is |
|---|---|
| `/home/sendfilesfree/sendfilesfree` | The git checkout, owned by `sendfilesfree` |
| `/home/sendfilesfree/sendfilesfree/.env.production` | **Build-time** `NEXT_PUBLIC_*` values. Gitignored. Changing one requires a rebuild, not a restart. |
| `/etc/sharefilesfree.env` | **Runtime** secrets (TURN, and the AdSense client id when ads go live). Root-owned, `chmod 600`. Read by systemd before it drops privileges, so the app user never needs read access. |
| `/etc/caddy/Caddyfile` | From `deploy/Caddyfile.example` |
| `/etc/default/caddy` | Holds `CF_API_TOKEN`. Root-owned, `chmod 600`. |
| `/etc/systemd/system/sharefilesfree.service` | From `deploy/app.service` |
| `/etc/systemd/system/signaling.service` | From `deploy/signaling.service` |
| `/etc/systemd/system/caddy.service.d/10-environment.conf` | Drop-in so Caddy reads `/etc/default/caddy` — see gotcha 3 |
| `/etc/ssh/sshd_config.d/01-hardening.conf` | From `deploy/harden.sh` — see gotcha 1 |
| `/etc/sysctl.d/99-disable-ipv6.conf` | See gotcha 4 |

---


## Storage: deliberately none

There is no R2 bucket, no upload endpoint, and no storage step in this deploy.
Files pass browser to browser and are never held anywhere, which is why this
runbook has no bucket to create, no lifecycle rule to configure, and no CORS
policy to get wrong.

If storage is ever added back — see the README's "No storage, on purpose" for
what that would mean legally — the full implementation is in git history on
branch `ads-and-storage-policy` through commit `7ae4989`. Register a company
before deploying it.

## Deploying an update

```bash
ssh -i ~/.ssh/sharefilesfree_deploy root@62.72.29.23
sff-deploy
```

That is the whole thing. `sff-deploy` fetches, fast-forwards, builds into a
separate directory so the live build keeps serving throughout, swaps it in with
a rename, restarts, health-checks, and rolls back by itself if the new build
does not answer. It restarts the signaling server only when `server/` changed,
since that drops any transfer mid-handshake.

`sff-deploy --force` rebuilds even when nothing changed; `sff-deploy --rollback`
puts the previous build back.

**When you change `deploy/deploy.sh` in the repo, the server does not pick it
up** — the installed copy is a separate file. Reinstall it:

```bash
install -m 755 /home/sendfilesfree/sendfilesfree/deploy/deploy.sh /usr/local/bin/sff-deploy
```

<details><summary>The manual sequence it replaced, for reference</summary>

```bash
cd /home/sendfilesfree/sendfilesfree
sudo -u sendfilesfree git pull
sudo -u sendfilesfree npm ci --no-audit --no-fund
sudo -u sendfilesfree npm run build      # ~60s on this box
systemctl restart sharefilesfree
# only if server/ changed:
systemctl restart signaling
```

Both windows this leaves open — a half-written build being served, and a
restart with nothing to catch it — are what `sff-deploy` exists to close.

</details>

Building on the box is fine — 4 GB RAM is ample and a full build takes about a
minute. If you ever move to a 1 GB instance this will OOM; build in CI instead
(`.github/workflows/ci.yml` already runs `npm run build`) and ship the artifact.

**If you changed a `NEXT_PUBLIC_*` value**, edit `.env.production` and rebuild.
Those are inlined into the client bundle at build time; a restart alone does
nothing.

### Cloudflare Cache Rules (do this in the dashboard — it is not in the repo)

Measured 6 Sep 2026: every route returned `cf-cache-status: DYNAMIC`. Nothing
was edge-cached except `/_next/static/`, so **every page view of all nineteen
tool pages reached the origin in India** — TTFB 0.38-1.49s, on one vCPU. That is
the first thing that falls over under a launch spike, and the traffic is the
point of the tool pages.

Caddy now emits a cacheable `Cache-Control` and a clean `Vary` for plain
document requests (see `deploy/Caddyfile.example`), but Cloudflare still will not
cache HTML unless a Cache Rule says so. Create one — Free plan allows 10:

- **Name**: `Cache prerendered HTML`
- **When incoming requests match**:
  `(not starts_with(http.request.uri.path, "/api/") and not starts_with(http.request.uri.path, "/_next/") and len(http.request.headers["rsc"]) eq 0)`
- **Then**: Cache eligibility → *Eligible for cache*; Edge TTL → *Use cache-control header if present*; Browser TTL → *Respect origin*

The RSC condition matters: those are Next.js client-side navigations and
prefetches, they legitimately vary per request, and caching them would serve one
route's payload for another.

Verify after applying — the second request should say `HIT`:

```bash
curl -sI https://sharefilesfree.com/tools/merge-pdf | grep -i cf-cache-status
curl -sI https://sharefilesfree.com/tools/merge-pdf | grep -i cf-cache-status   # expect HIT
# and confirm an RSC request is NOT served from cache:
curl -sI -H 'RSC: 1' https://sharefilesfree.com/tools/merge-pdf | grep -i cf-cache-status
```

**After a deploy**, cached HTML can briefly reference chunk URLs the new build no
longer has. The 60-second edge TTL keeps that window short; purge the cache
after a deploy if you want it gone immediately (needs an API token with
`Cache Purge`, which the Caddy DNS token does not have).

### What the transfers are actually doing

`GET /api/metrics` returns running totals — how many connections went direct,
how many fell back to the relay, how many failed, how many transfers finished:

```bash
curl -s https://sharefilesfree.com/api/metrics
```

`relayRatio` is the number that matters. Relayed bytes are the overwhelming
majority of what this service costs to run (Cloudflare TURN is $0.05/GB after
1,000 GB/month free), so that ratio times traffic is the hosting bill. It is
also the only way to tell whether a networking change helped. Counters are
in-memory and reset on restart — record them somewhere before a deploy if you
want a trend.

### Checking health

```bash
systemctl status sharefilesfree signaling caddy
journalctl -u sharefilesfree -f
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
curl -s http://127.0.0.1:8080/healthz            # -> ok
```

---

## Gotchas hit during setup

All of these cost real time. The first five are fixed in `deploy/`; the sixth is
fixed in the app itself. The reasoning matters if you rebuild this on another box
— or put any other proxy in front of the signaling server.

### 1. SSH hardening silently did nothing

Ubuntu cloud images ship `/etc/ssh/sshd_config.d/50-cloud-init.conf` containing
`PasswordAuthentication yes`. **OpenSSH uses the first value it obtains for a
keyword, not the last**, and drop-ins are read in lexical order — so a file named
`99-hardening.conf` is silently ignored and the box keeps accepting passwords.

The hardening file must sort *before* `50-`. It is now `01-hardening.conf`, and
`deploy/harden.sh` asserts `sshd -T` actually reports `passwordauthentication no`
rather than assuming the write worked.

### 2. systemd sandboxing broke Next.js

`RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX` blocks `AF_NETLINK`. Next.js
calls `os.networkInterfaces()` at startup to print the LAN URL, which on Linux
goes through a netlink socket — so the server threw
`EAFNOSUPPORT (errno 97)` on boot and never served a request, while systemd
still reported the unit as `active`.

`deploy/app.service` now includes `AF_NETLINK`. `deploy/signaling.service` does
not need it and stays stricter.

### 3. Caddy does not read `/etc/default/caddy`

Its packaged systemd unit has no `EnvironmentFile` directive, so the Debian
`/etc/default/` convention does not apply. `CF_API_TOKEN` was present in the file
and Caddy still reported `API token '' appears invalid`.

Fixed with a drop-in at `/etc/systemd/system/caddy.service.d/10-environment.conf`
rather than editing the packaged unit, so `apt upgrade` preserves it.

### 4. The API token IP pin blocked everything (IPv6)

The Cloudflare API token is restricted by source IP — worth doing, since that
token can rewrite DNS. But the VPS is dual-stack and glibc prefers IPv6 outbound,
so Cloudflare saw requests from `2a02:4780:12:1144::1` and rejected every ACME
challenge with `HTTP 403 Code 9109: Cannot use the access token from location`.

Two traps here. First, `/user/tokens/verify` **does not enforce the IP filter**,
so it returns "valid and active" over IPv6 while real calls 403 — test with an
actual zone call instead. Second, setting `precedence ::ffff:0:0/96 100` in
`/etc/gai.conf` did not change address selection on this box.

Resolved by disabling IPv6 (`/etc/sysctl.d/99-disable-ipv6.conf`). Safe here
because nothing reaches the origin over IPv6: all hostnames are proxied, and
Cloudflare connects back via the A record. Visitors still get IPv6 to the edge.

To reverse: delete that file, reboot, and add the IPv6 address to the token's
IP filter in Cloudflare.

### 5. Caddy falls back to Let's Encrypt staging

After repeated challenge failures, CertMagic switches to the staging CA to avoid
burning production rate limits. Staging certificates are not trusted by browsers.
After fixing the underlying cause, clear the ACME state so it re-registers
against production:

```bash
systemctl stop caddy
rm -rf /var/lib/caddy/.local/share/caddy/acme
systemctl start caddy
```

Verify the issuer is real, not staging:

```bash
find /var/lib/caddy -name '*.crt' -exec openssl x509 -in {} -noout -issuer \;
# expect: issuer=C=US, O=Let's Encrypt, CN=...   (path contains acme-v02, not acme-staging-v02)
```

### 6. Cloudflare's proxy closed every idle signaling WebSocket

The one that broke the actual product rather than the setup, and the only one
here that a green `systemctl status` and a passing health check both report as
fine.

Cloudflare closes a proxied WebSocket that has carried no traffic for about 100
seconds. The signaling protocol went silent the moment a room was created — the
sender waits, the receiver hasn't typed the code yet, neither side has anything
to say — so the connection was cut at ~124 seconds (close code 1006, no close
frame). That fired `close` on the server, which deleted the room, so:

- codes stopped working after ~2 minutes regardless of the 10/30/60/120-minute
  duration the sender picked and paid an ad for;
- the receiver got "That code is invalid or has expired";
- the sender got an error next to a code the server had already forgotten.

Nothing about this is visible locally, where the browser connects straight to
`ws://localhost:8080` with no proxy in between and `ws` never times out an idle
connection on its own.

Fixed in `server/index.js` with a 30-second ping/pong heartbeat (browsers answer
a ping in the network stack, so it survives a backgrounded tab — which matters
because "leave the tab open" is the product), plus a matching client-side
keepalive in `src/lib/peerTransfer.ts`. The same heartbeat reaps sockets that
died without a close frame, which used to leak their rooms until TTL.

`server/test-signaling.mjs` asserts both halves; run the server with
`SIGNALING_HEARTBEAT_MS` set low to exercise it quickly.

To check it against the live deployment, open a WebSocket to
`wss://signal.sharefilesfree.com`, send nothing, and confirm it is still open
after three minutes.

---

## Why the DNS records are proxied (orange), not "DNS only"

An earlier version of this guide said to keep every record grey so Caddy could
complete HTTP-01 challenges. That works, but it publishes the origin IP —
anyone can then DDoS or port-scan the box straight past Cloudflare. Measured on
4 Sep 2026, that is exactly the position `toffeeshare.com` is in (origin
`206.189.1.166` openly reachable), while `snapdrop.net`, `wormhole.app` and
`ilovepdf.com` are all fully proxied.

Proxied gives you a hidden origin, DDoS absorption, the free WAF, and asset
caching at Cloudflare's Mumbai PoP. The cost is that Cloudflare terminates TLS,
which is worth weighing but costs less here than it would elsewhere: no file
bytes ever cross this origin, only the page and the signaling handshake.

Certificates therefore use **DNS-01**, which proves domain control via a TXT
record and works fine behind the proxy. That needs the `caddy-dns/cloudflare`
plugin, which is not in the default binary:

```bash
caddy add-package github.com/caddy-dns/cloudflare
systemctl restart caddy
```

The API token needs **two** permissions — `Zone:DNS:Edit` **and** `Zone:Zone:Read`
(the plugin looks the zone up by name before writing) — scoped to this zone only.
Not the Global API Key.

---

## Maintenance

- **Security updates** apply automatically via `unattended-upgrades`. Reboot when
  `/var/run/reboot-required` appears.
- **Certificates** renew automatically. They will fail silently if the Cloudflare
  API token is deleted, expires, or the server IP changes — the token is pinned
  to `62.72.29.23`.
- **fail2ban** is active on SSH.
- **Backups**: Hostinger takes weekly snapshots. The only irreplaceable state on
  this box is `/etc/sharefilesfree.env` and `/etc/default/caddy`; everything else
  is in git.

---

## Monetization

Deliberately not sequenced here by traffic. The blocker for AdSense on a site
like this is not visitor count — Google's published eligibility rules state no
minimum traffic and no minimum site age — it is that tool-only pages give a
reviewer almost nothing to assess, which is a well-documented "low value content"
rejection pattern.

So: add real editorial substance to the 19 tool pages first, then apply.
Popunder and push networks (Adsterra, Monetag, PopAds, PopCash, AdMaven) are
ruled out permanently — a domain on a Safe Browsing blocklist stops the download
links working, so the failure mode is the entire product, not just lost revenue.
