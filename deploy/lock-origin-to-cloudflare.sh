#!/usr/bin/env bash
# Restrict inbound 80/443 to Cloudflare's published ranges.
#
#   sudo bash deploy/lock-origin-to-cloudflare.sh
#
# WHY THIS EXISTS
# ---------------
# Measured on 7 September 2026, both of these answered directly, with no
# Cloudflare in front of them:
#
#   curl -sI --resolve sharefilesfree.com:443:62.72.29.23 https://sharefilesfree.com/
#   curl -sI --resolve signal.sharefilesfree.com:443:62.72.29.23 https://signal.sharefilesfree.com/healthz
#
# Both returned 200 with `via: 1.1 Caddy` and no `cf-ray`, which means anyone
# who learns the origin IP can talk to Caddy and to the app straight past the
# proxy. DNS is proxied and the Caddyfile explains at length why that matters,
# but proxied DNS only hides the address — it does not stop anyone who already
# has it, and an origin IP is not a secret in practice. Certificate
# transparency logs, historical DNS, and any past unproxied record all leak it,
# and this one is written down in DEPLOYMENT.md besides.
#
# What that bypass costs, concretely:
#
#   1. Cloudflare's DDoS absorption, WAF and bot management stop applying. A
#      1-vCPU origin is directly reachable by anyone who wants to flood it.
#   2. Every rate limit in the app becomes forgeable. The limiters key on the
#      client IP, and the only trustworthy sources for that are headers written
#      by Cloudflare (CF-Connecting-IP) or by Caddy. A caller who reaches the
#      origin directly writes those headers themselves — so room-creation
#      limits, join brute-force limits, TURN credential limits and the metrics
#      limiter are all defeated by one header on a direct connection.
#
# The second one is why this script is not optional. src/lib/rateLimit.ts and
# server/index.js were both fixed to stop trusting the leftmost
# X-Forwarded-For entry, but no header rule can be trusted while anyone can
# connect to the origin and write any header they like. The header fix and this
# firewall are one control in two halves; neither works without the other.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/lock-origin-to-cloudflare.sh" >&2
  exit 1
fi

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

say "Fetching Cloudflare's current IP ranges"
# Straight from Cloudflare, never a copy pasted into this repo: the ranges do
# change, and a stale hardcoded list fails closed — it locks out real visitors
# arriving through a range added after the list was written.
V4=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v4)
V6=$(curl -fsS --max-time 20 https://www.cloudflare.com/ips-v6)

if [[ -z "$V4" ]]; then
  echo "    Refusing to continue: could not fetch the IPv4 list." >&2
  echo "    Applying a partial rule set would lock the site off the internet." >&2
  exit 1
fi
echo "    $(wc -l <<<"$V4") IPv4 ranges, $(wc -l <<<"$V6") IPv6 ranges"

# SSH must survive this, and it is allowed from anywhere on purpose: Cloudflare
# does not proxy SSH, so pinning 22 to their ranges would mean locking yourself
# out. It is key-only with fail2ban in front (see harden.sh), which is the
# control that belongs on that port.
say "Confirming SSH stays open before touching anything"
ufw allow OpenSSH >/dev/null
echo "    OpenSSH rule present"

say "Replacing the open 80/443 rules with Cloudflare-only ones"
# Delete the existing any-source rules. `ufw delete` is a no-op with a warning
# if the rule is already gone, which is why this is not fatal.
ufw --force delete allow 80/tcp 2>/dev/null || true
ufw --force delete allow 443/tcp 2>/dev/null || true

while read -r cidr; do
  [[ -z "$cidr" ]] && continue
  ufw allow from "$cidr" to any port 80 proto tcp >/dev/null
  ufw allow from "$cidr" to any port 443 proto tcp >/dev/null
done <<<"$V4"

while read -r cidr; do
  [[ -z "$cidr" ]] && continue
  ufw allow from "$cidr" to any port 80 proto tcp >/dev/null
  ufw allow from "$cidr" to any port 443 proto tcp >/dev/null
done <<<"$V6"

ufw --force enable >/dev/null
say "Done"
ufw status numbered | head -20
cat <<'EOF'

  VERIFY NOW, from your laptop, before closing this session:

    # Should still work (through Cloudflare):
    curl -sI https://sharefilesfree.com/ | head -1

    # Should now hang or be refused (straight to the origin):
    curl -sI --max-time 10 --resolve sharefilesfree.com:443:62.72.29.23 \
      https://sharefilesfree.com/ | head -1

  If the first one fails, run `ufw allow 80/tcp && ufw allow 443/tcp` to put
  things back, and work out why before retrying.

  RE-RUN THIS when Cloudflare changes its ranges. They are stable but not
  frozen; a monthly cron is enough:
    0 4 1 * * root bash /home/sendfilesfree/sendfilesfree/deploy/lock-origin-to-cloudflare.sh
EOF
