#!/usr/bin/env bash
# First-boot hardening for the ShareFilesFree VPS. Run once, as root, on a
# fresh Ubuntu LTS box, BEFORE deploying the app.
#
#   sudo bash deploy/harden.sh
#
# What it does: creates the unprivileged app user, locks SSH to key-only auth,
# closes every port except 22/80/443, turns on automatic security updates, and
# installs fail2ban.
#
# SAFETY: this script REFUSES to disable password authentication until it can
# see a non-empty authorized_keys for a user who can still log in. Locking
# yourself out of a fresh VPS is the classic way this goes wrong.
set -euo pipefail

APP_USER="sendfilesfree"

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash deploy/harden.sh" >&2
  exit 1
fi

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

# --- 1. Unprivileged app user ------------------------------------------------
say "Creating app user '$APP_USER'"
if id -u "$APP_USER" >/dev/null 2>&1; then
  echo "    already exists, leaving alone"
else
  adduser --system --group --shell /bin/bash --home "/home/$APP_USER" "$APP_USER"
  echo "    created (system account, no password login)"
fi

# --- 2. SSH keys: verify BEFORE locking anything -----------------------------
say "Checking for a usable SSH key"
KEYED_USER=""
for u in root $(getent passwd | awk -F: '$3>=1000 && $3<65534 {print $1}'); do
  home=$(getent passwd "$u" | cut -d: -f6)
  ak="$home/.ssh/authorized_keys"
  if [[ -s "$ak" ]] && grep -qE '^(ssh|ecdsa|sk-)' "$ak"; then
    KEYED_USER="$u"
    echo "    found key(s) for: $u"
  fi
done

if [[ -z "$KEYED_USER" ]]; then
  cat >&2 <<'MSG'

    ABORTING — no authorized_keys found for any login user.

    Disabling password authentication now would lock you out of this box
    permanently. Add your public key first, from your laptop:

        ssh-copy-id root@<this-server-ip>

    then re-run this script.

MSG
  exit 1
fi

# --- 3. Lock down SSH --------------------------------------------------------
say "Hardening SSH (key-only, no root password login)"
install -d -m 755 /etc/ssh/sshd_config.d
# NAME MATTERS. OpenSSH uses the FIRST value it obtains for a keyword, not the
# last, and drop-ins are read in lexical order. Ubuntu cloud images ship
# /etc/ssh/sshd_config.d/50-cloud-init.conf containing "PasswordAuthentication
# yes" — so a file named 99-* is silently ignored and the box keeps accepting
# passwords. Verified the hard way on 4 Sep 2026. Sort first, always.
rm -f /etc/ssh/sshd_config.d/99-hardening.conf
cat > /etc/ssh/sshd_config.d/01-hardening.conf <<'EOF'
# Written by deploy/harden.sh
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PermitEmptyPasswords no
MaxAuthTries 3
EOF

# Never reload a config that does not parse.
if sshd -t; then
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
  # Assert the drop-in actually won, rather than trusting that it did.
  if sshd -T | grep -qx "passwordauthentication no"; then
    echo "    applied and verified: password authentication is off"
    echo "    keep your current session open and test a NEW one before closing it"
  else
    echo "    WARNING: password authentication is STILL ON — another drop-in in" >&2
    echo "    /etc/ssh/sshd_config.d/ is overriding this one. Inspect it." >&2
  fi
else
  echo "    sshd config failed validation — reverting" >&2
  rm -f /etc/ssh/sshd_config.d/01-hardening.conf
  exit 1
fi

# --- 4. Firewall -------------------------------------------------------------
say "Firewall: allowing only SSH, HTTP, HTTPS"
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq ufw >/dev/null
# Order matters: allow SSH BEFORE enabling, or this cuts your own session.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw default deny incoming
ufw default allow outgoing
ufw --force enable
echo "    Node (3000) and signaling (8080) stay closed to the internet —"
echo "    Caddy reaches them on localhost."

# --- 5. Automatic security updates ------------------------------------------
say "Enabling unattended security upgrades"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades >/dev/null
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
echo "    on — this is the single thing that most often saves a self-managed box"

# --- 6. fail2ban -------------------------------------------------------------
say "Installing fail2ban (SSH brute-force protection)"
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban >/dev/null
systemctl enable --now fail2ban
echo "    on"

say "Done"
cat <<EOF

  Before you close this terminal, open a SECOND one and confirm you can
  still log in. If you cannot, this session is your only way back.

  Next: install Node and Caddy, then the two systemd units in deploy/.
EOF
