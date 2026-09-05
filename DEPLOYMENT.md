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

Cloudflare R2          → NOT YET CONFIGURED (link fallback disabled)
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
| `/etc/sharefilesfree.env` | **Runtime** secrets (R2, TURN). Root-owned, `chmod 600`. Read by systemd before it drops privileges, so the app user never needs read access. |
| `/etc/caddy/Caddyfile` | From `deploy/Caddyfile.example` |
| `/etc/default/caddy` | Holds `CF_API_TOKEN`. Root-owned, `chmod 600`. |
| `/etc/systemd/system/sharefilesfree.service` | From `deploy/app.service` |
| `/etc/systemd/system/signaling.service` | From `deploy/signaling.service` |
| `/etc/systemd/system/caddy.service.d/10-environment.conf` | Drop-in so Caddy reads `/etc/default/caddy` — see gotcha 3 |
| `/etc/ssh/sshd_config.d/01-hardening.conf` | From `deploy/harden.sh` — see gotcha 1 |
| `/etc/sysctl.d/99-disable-ipv6.conf` | See gotcha 4 |

---

## Still outstanding

### ~~1. Cloudflare TURN~~ — done, 5 September 2026

`CLOUDFLARE_TURN_KEY_ID` and `CLOUDFLARE_TURN_API_TOKEN` are set in
`/etc/sharefilesfree.env`. Runtime secrets, not `NEXT_PUBLIC_*`, so a restart
applies them — no rebuild. Free up to 1,000 GB/month, and only relayed traffic
counts against it.

**Verify it, don't assume it.** `/api/turn-credentials` is written to fail soft:
a missing variable, a wrong token and a Cloudflare outage all return the same
`{"turnConfigured": false}`, and the browser silently drops to STUN-only. A
broken relay is invisible from the site itself, because most networks connect
directly anyway and never need it.

```bash
curl -s https://sharefilesfree.com/api/turn-credentials    # expect turnConfigured: true
```

That only proves credentials are being issued. To prove the relay actually
allocates, open a `RTCPeerConnection` with `iceTransportPolicy: "relay"` — which
discards host and srflx candidates — and gather. Any candidate that survives came
from the TURN server. Measured 5 Sep 2026: 8 relay candidates on Cloudflare's
`104.30.0.0/16` edge, over UDP.

**Rotating the key:** create the new key first, swap both values, restart, confirm
`true`, and only then delete the old key in the dashboard — that order has no
window where neither works.

```bash
sed -i '/^CLOUDFLARE_TURN_KEY_ID=/d;/^CLOUDFLARE_TURN_API_TOKEN=/d' /etc/sharefilesfree.env
cat >> /etc/sharefilesfree.env <<'EOF'
CLOUDFLARE_TURN_KEY_ID=...
CLOUDFLARE_TURN_API_TOKEN=...
EOF
systemctl restart sharefilesfree
```

Two traps, both hit for real during setup. **No space after the `=`.** And don't
paste an `ssh` line and the commands meant for the far end as one block — every
line after `ssh` becomes its *stdin*, so on a first connection the host-fingerprint
prompt eats the next line as its answer and nothing runs on the server.

### 2. Cloudflare R2 — the "receiver isn't online" link fallback

Until this is set, `isR2Configured()` returns false and only the P2P path is
offered. The app works without it.

1. Cloudflare → **R2 → Create bucket**, e.g. `sendfilesfree-uploads`.
2. **R2 → Manage API tokens → Create API token**, permission **Object Read & Write**,
   scoped to that bucket. Save the Access Key ID and Secret Access Key (shown once).
   Your Account ID is on the R2 overview page.
3. Bucket → **Settings → Object lifecycle rules** → delete objects after **7 days**.
   Seven days is the longest window the retention ladder grants any file (see
   the README's "Link size and retention"); anything shorter would delete files
   before their stated expiry. **Don't skip it** — without it expired files sit
   in the bucket forever and quietly cost money.
4. Bucket → **Settings → CORS Policy** → allow `PUT` from
   `https://sharefilesfree.com` with `ExposeHeaders: ["ETag"]`. Required for
   files over 10 MB, which use multipart upload and need the browser to read back
   each part's ETag. Exact JSON is in the README. **Never tested against a live
   bucket** — verify large-file upload after configuring.
5. Add to `/etc/sharefilesfree.env`, then `systemctl restart sharefilesfree`:
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_BUCKET_NAME=sendfilesfree-uploads
   ```
   `MAX_UPLOAD_BYTES` and `UPLOAD_EXPIRY_HOURS` are both optional — leave them
   unset and the retention ladder decides (up to 50GB, kept for less the bigger
   it is). Set `MAX_UPLOAD_BYTES` only to make the ceiling *smaller* than that.

> **Before enabling R2, read this.** The link path currently uploads the
> **plaintext file**. The optional password in `src/lib/r2.ts` gates the download
> URL; it encrypts nothing. Cloudflare will hold readable copies of every file
> that takes this path. The fix is client-side AES-GCM encryption with the key in
> the URL fragment (fragments are never sent to a server). Until that ships, the
> "your files never leave your device" claim is true of the P2P path only.

### 3. Content-Security-Policy

`next.config.ts` still ships no CSP. The blocker is that `tesseract.js` fetches
its wasm core from `cdn.jsdelivr.net` at runtime, so any strict `script-src`
breaks OCR. Self-host `tesseract.js-core` and the tessdata files first, then add
the CSP — signaling is same-origin-ish through Cloudflare, so `connect-src` is
tractable now.

---

## Deploying an update

```bash
ssh -i ~/.ssh/sharefilesfree_deploy root@62.72.29.23
cd /home/sendfilesfree/sendfilesfree
sudo -u sendfilesfree git pull
sudo -u sendfilesfree npm ci --no-audit --no-fund
sudo -u sendfilesfree npm run build      # ~60s on this box
systemctl restart sharefilesfree
# only if server/ changed:
systemctl restart signaling
```

Building on the box is fine — 4 GB RAM is ample and a full build takes about a
minute. If you ever move to a 1 GB instance this will OOM; build in CI instead
(`.github/workflows/ci.yml` already runs `npm run build`) and ship the artifact.

**If you changed a `NEXT_PUBLIC_*` value**, edit `.env.production` and rebuild.
Those are inlined into the client bundle at build time; a restart alone does
nothing.

### Checking health

```bash
systemctl status sharefilesfree signaling caddy
journalctl -u sharefilesfree -f
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/
curl -s http://127.0.0.1:8080/healthz            # -> ok
```

---

## Gotchas hit during setup

All four cost real time. They are fixed in `deploy/`, but the reasoning matters
if you rebuild this on another box.

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

---

## Why the DNS records are proxied (orange), not "DNS only"

An earlier version of this guide said to keep every record grey so Caddy could
complete HTTP-01 challenges. That works, but it publishes the origin IP —
anyone can then DDoS or port-scan the box straight past Cloudflare. Measured on
4 Sep 2026, that is exactly the position `toffeeshare.com` is in (origin
`206.189.1.166` openly reachable), while `snapdrop.net`, `wormhole.app` and
`ilovepdf.com` are all fully proxied.

Proxied gives you a hidden origin, DDoS absorption, the free WAF, and asset
caching at Cloudflare's Mumbai PoP. The cost is that Cloudflare terminates TLS —
already true in practice, since R2 is intended to hold the files themselves.

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
