# Deployment Guide — everything that has to happen on your side

This is a start-to-finish runbook. Everything here requires **your own accounts** (domain registrar, Cloudflare, Google Cloud, GitHub) — none of this can be done for you from inside this chat. Follow it top to bottom; each phase says exactly what to click and what to type.

## A course correction from earlier in our discussion

Earlier I mentioned Cloudflare Pages for hosting the frontend. Since then we've built API routes that need real Node.js (the R2 upload/download logic) — Cloudflare's Next.js hosting runs on its Workers runtime, which doesn't support that the same way. Rather than fight that mismatch, **the simplest, most predictable setup is to run the website and signaling server together on one small VPS**, using Caddy for free automatic HTTPS. This is a much more standard, well-documented deployment shape.

**Second course correction, this one making things cheaper**: TURN (the fallback relay for connections that can't go direct P2P) no longer needs its own VPS at all. Cloudflare has a managed TURN service with **1,000 GB/month free**, which is a lot of headroom for a starting product. Combined with **Google Cloud's e2-micro instance, which is free forever** (not a 12-month trial), the entire hosting cost for this app can be **$0/month** — only the domain remains a real, ongoing cost.

## Progress

- ✅ **Phase 1 done** — `sharefilesfree.com` purchased on Hostinger (₹1,081/yr).
- 🔄 **Phase 2 in progress** — you're partway through connecting the domain to Cloudflare.
- ⬜ Everything from Phase 3 onward is still ahead of you.

## What you'll end up with

```
Your domain (DNS via Cloudflare, free)
 ├─ sharefilesfree.com, www       → GCP VM, Next.js app (Caddy: automatic HTTPS)
 └─ signal.sharefilesfree.com     → GCP VM, signaling server (Caddy: automatic HTTPS)

Cloudflare R2 (free tier)      → uploaded files for the "share a link" fallback
Cloudflare Realtime TURN (free up to 1,000 GB/month) → relay for connections that can't go direct P2P
```

## Accounts you need to create

| Account | Cost | Used for |
|---|---|---|
| ~~A domain registrar~~ Hostinger | ~~$10-15/yr~~ ✅ done — ₹1,081/yr | `sharefilesfree.com` |
| Cloudflare | Free | DNS + R2 storage + Realtime TURN |
| Google Cloud | Free (e2-micro, "Always Free" tier) | Runs the app + signaling server |
| GitHub | Free | Hosts your code so the VM can pull it |
| Google AdSense | Free to apply | Monetization (Phase 13 — near the end of this guide) |

**Note on Google Cloud**: it asks for a card during signup to verify you're a real person, but an e2-micro instance kept within the Always Free limits (one instance, in an eligible region, described below) won't charge you anything. Setting a free **budget alert** in Phase 4 is a good safety net regardless.

---

## Phase 1 — Buy a domain ✅ done

`sharefilesfree.com` is bought and paid for on Hostinger. Nothing left to do here.

## Phase 2 — Put your domain on Cloudflare (DNS + R2 + TURN account)

1. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Add a site** → enter `sharefilesfree.com` → pick the **Free** plan.
3. On the DNS review screen, set the found records to **DNS only** (grey cloud) and continue — they're just Hostinger's parking-page placeholders and will be replaced in Phase 6.
4. Cloudflare shows you two nameservers (something like `xxx.ns.cloudflare.com`). Now go point Hostinger at them:
   - Log into [hpanel.hostinger.com](https://hpanel.hostinger.com) → **Domains** → select `sharefilesfree.com`.
   - Find **DNS / Nameservers** (sometimes under "Advanced" or a "Nameservers" tab) → switch from Hostinger's default nameservers to **Custom nameservers** → paste in the two Cloudflare gave you → Save.
5. Wait for Cloudflare to show the domain as **Active** (usually minutes, sometimes a few hours — nameserver changes can occasionally take longer to propagate).

You now have a place to manage DNS records — you'll add three in Phase 6 (`@`, `www`, `signal`). **Leave every DNS record you create as "DNS only" (grey cloud, not orange)** — we're using Caddy for HTTPS directly on the VM, and Cloudflare's proxy adds complexity we don't need for this setup.

## Phase 3 — Push your code to GitHub

```bash
cd /Users/sarth/sendfilesfree
gh repo create sendfilesfree --private --source=. --remote=origin
git add -A
git commit -m "Initial ShareFilesFree app"
git push -u origin HEAD
```

(If you don't have the `gh` CLI set up with your GitHub account, create the empty repo at github.com instead, then `git remote add origin <url>` and push.)

## Phase 4 — Create the Google Cloud VM (free forever)

1. Sign up at [console.cloud.google.com](https://console.cloud.google.com) and create a project.
2. **Billing → Budgets & alerts → Create budget** — set a small alert (e.g. ₹100) as a tripwire in case anything ever falls outside the free tier. Costs nothing, just an early warning.
3. **Compute Engine → VM instances → Create instance**. This matters — get these exact settings or you'll be billed:
   - **Region**: one of `us-west1`, `us-central1`, or `us-east1` **only** — these are the only regions the free e2-micro applies to. Any other region bills normally.
   - **Machine type**: `e2-micro`.
   - **Boot disk**: Ubuntu 24.04 LTS, up to 30GB standard persistent disk (within the free allowance).
   - Under **Firewall**, tick **Allow HTTP traffic** and **Allow HTTPS traffic** — this creates the needed firewall rules for you automatically.
4. Once created, go to **VPC network → IP addresses**, find the instance's external IP, and click **Reserve** to make it **static**. (By default GCP's external IPs are ephemeral and can change if the instance restarts — reserving it now means your DNS records in Phase 6 won't silently break later.) Note this IP down.
5. Click the **SSH** button next to your instance in the console — this opens a full terminal in your browser, no key setup needed. Use this for every command below. (You're logged in as your own non-root user with sudo already — no need to create one manually, unlike a typical bare VPS.)

Install Node.js and Caddy:
```bash
# Node.js
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs

# Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

**e2-micro only has 1GB of RAM**, which isn't quite enough to run `npm run build` reliably on its own — add a 2GB swap file (a one-time, standard fix for small cloud instances) before Phase 8:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Phase 5 — Create a Cloudflare TURN key

1. In the Cloudflare dashboard: **Calls** (also labeled **Realtime**) → **Create TURN key** (or "Create application" → TURN).
2. It gives you a **TURN Key ID** and an **API Token** — copy both now, the token is shown only once.

## Phase 6 — DNS records for the VM

Back in the Cloudflare dashboard, under your domain's **DNS** page, add (all set to **DNS only**, grey cloud):

| Type | Name | Content |
|---|---|---|
| A | `@` | YOUR_STATIC_IP |
| A | `www` | YOUR_STATIC_IP |
| A | `signal` | YOUR_STATIC_IP |

(Delete the two placeholder records Cloudflare imported from Hostinger during Phase 2 if they're still there.)

## Phase 7 — Set up Cloudflare R2 (the "share a link" storage fallback)

1. In Cloudflare: **R2 → Create bucket** → name it e.g. `sendfilesfree-uploads`.
2. **R2 → Manage API tokens → Create API token**, permission **Object Read & Write**, scoped to that bucket. Save the **Access Key ID** and **Secret Access Key** it shows you (shown once). Your **Account ID** is on the R2 overview page.
3. On the bucket → **Settings → Object lifecycle rules** → add a rule to delete objects after **1-2 days** (match this to `UPLOAD_EXPIRY_HOURS` below). **Don't skip this step** — without it, expired files sit in the bucket forever and quietly cost you money.

## Phase 8 — Clone the code and configure secrets

Back on the VM (still in the browser SSH window):
```bash
git clone https://github.com/YOUR_USERNAME/sendfilesfree.git
cd sendfilesfree
```

Create `.env.production` in the project root with your real values:
```bash
cat > .env.production <<'EOF'
NEXT_PUBLIC_SIGNALING_URL=wss://signal.sharefilesfree.com

CLOUDFLARE_TURN_KEY_ID=paste-the-turn-key-id-here
CLOUDFLARE_TURN_API_TOKEN=paste-the-turn-api-token-here

R2_ACCOUNT_ID=your-cloudflare-account-id
R2_ACCESS_KEY_ID=your-r2-access-key-id
R2_SECRET_ACCESS_KEY=your-r2-secret-access-key
R2_BUCKET_NAME=sendfilesfree-uploads
MAX_UPLOAD_BYTES=2147483648
UPLOAD_EXPIRY_HOURS=24
EOF
```
Replace every placeholder value above with your real ones (`nano .env.production` to edit). **`NEXT_PUBLIC_*` values are baked in at build time**, so this file must be correct *before* the build step below — if you ever change one, you need to rebuild.

## Phase 9 — Build and run the Next.js app

```bash
npm install
npm run build
```
(This is what the swap file from Phase 4 is for — if this step is ever killed unexpectedly, confirm `swapon --show` shows the swap file is active.)

Create the systemd service:
```bash
sudo tee /etc/systemd/system/sendfilesfree.service > /dev/null <<'EOF'
[Unit]
Description=ShareFilesFree Next.js app
After=network.target

[Service]
Type=simple
User=YOUR_GCP_USERNAME
WorkingDirectory=/home/YOUR_GCP_USERNAME/sendfilesfree
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=3
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now sendfilesfree
```
(Replace `YOUR_GCP_USERNAME` with whatever your browser-SSH prompt shows, e.g. run `whoami` to check.)

## Phase 10 — Run the signaling server

```bash
cd ~/sendfilesfree/server
npm install
sudo cp ../deploy/signaling.service /etc/systemd/system/signaling.service
sudo systemctl daemon-reload
sudo systemctl enable --now signaling
```
(Edit `/etc/systemd/system/signaling.service` first if `YOUR_GCP_USERNAME` isn't literally `sendfilesfree` — same fix as the note above.)

## Phase 11 — Caddy: free HTTPS for the site and the signaling server

```bash
sudo tee /etc/caddy/Caddyfile > /dev/null <<'EOF'
sharefilesfree.com, www.sharefilesfree.com {
	reverse_proxy localhost:3000
}

signal.sharefilesfree.com {
	reverse_proxy localhost:8080
}
EOF
sudo systemctl restart caddy
```
Caddy fetches and auto-renews Let's Encrypt certificates for both hostnames the first time it starts — no manual certbot steps needed.

## Phase 12 — Test it end-to-end

- Visit `https://sharefilesfree.com` — the site should load over HTTPS with no certificate warnings.
- Open it on two devices on **different networks** (e.g. your phone on cellular data + your laptop on wifi) — this is the case that actually exercises the TURN relay, not just STUN.
- Send a file from one to the other using the 6-digit code.
- Wait ~20 seconds without entering the code anywhere to confirm the "share a link instead" button appears, click it, and confirm the resulting `/download/...` link works from a third device.
- `sudo journalctl -u sendfilesfree -f` and `-u signaling -f` are your two log streams on the VM if anything doesn't work. For TURN, check usage/errors in the Cloudflare dashboard under **Calls/Realtime**.

## Phase 13 — Updating the app later

```bash
# Open the VM's SSH from the GCP console, then:
cd ~/sendfilesfree && git pull
npm install && npm run build
sudo systemctl restart sendfilesfree
cd server && npm install
sudo systemctl restart signaling
```

## Phase 14 — Monetization: Google AdSense (once you have real traffic)

1. Apply at [adsense.google.com](https://adsense.google.com) with your domain. Approval typically requires a working privacy policy page and some real content/traffic first.
2. **You'll need a Privacy Policy page before applying** — this app handles uploaded files and will start showing ads, both of which AdSense's review checks for. Ask me and I'll draft one once you're ready for this step; it's a separate task from infrastructure.
3. Once approved, AdSense gives you a snippet and a publisher ID. Two things then need to happen in the codebase (not built yet — ask me when you get here):
   - Add `public/ads.txt` with the line AdSense gives you.
   - Add the actual ad unit to the transfer pages — per the plan, styled as a WeTransfer-style full-page background rather than a banner, since that format holds up better against ad blockers and doesn't clutter the actual tool.
4. Traffic milestones worth remembering from the plan: graduate to **Ezoic** once you clear ~10k visits/month (pays noticeably more than AdSense), and evaluate **Mediavine** at ~50k sessions/month.

## Ongoing maintenance checklist

- **Uptime monitoring**: a free [UptimeRobot](https://uptimerobot.com) check against `https://sharefilesfree.com` takes 2 minutes to set up and will email you if the VM or app goes down.
- **OS updates**: `sudo apt update && sudo apt upgrade -y` on the VM periodically.
- **Certs**: Caddy renews its own certs automatically — nothing for you to do.
- **R2 lifecycle rule**: double-check it's still active after any bucket changes — it's the only thing preventing indefinite storage cost growth.
- **Costs to watch**: the GCP budget alert from Phase 4 covers the VM; Cloudflare Realtime's dashboard shows TURN usage against the 1,000 GB/month free threshold; R2's usage dashboard and AdSense's earnings dashboard are the other two worth a monthly glance.
