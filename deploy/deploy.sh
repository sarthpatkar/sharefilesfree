#!/usr/bin/env bash
#
# Deploy sharefilesfree.com.
#
# Install on the VPS as /usr/local/bin/sff-deploy, then deploying is one word.
#
# What this fixes over doing it by hand
# -------------------------------------
# The manual sequence was: git pull, npm ci, npm run build, systemctl restart.
# It has two windows where the site is broken, and both were observed live:
#
#   1. `npm run build` wrote into .next while the running server was still
#      reading from it. For the length of the build — up to a minute — the
#      server could be asked for a chunk that had just been deleted. This
#      script builds into a separate directory and swaps it in with a rename,
#      so the live build is never touched until it is replaced, all at once.
#
#   2. `systemctl restart` drops connections for a second or two, which
#      Cloudflare surfaces to visitors as a 522. That window can't be removed
#      without running two instances, but it is now covered from the other
#      side: the Caddyfile retries a refused upstream for a few seconds
#      instead of failing (see deploy/Caddyfile.example).
#
# It also refuses to leave a broken deploy up: if the new build doesn't answer
# after the restart, the previous one is put back and the service restarted
# again, before you are told anything failed.
#
# Usage:
#   sff-deploy              deploy origin's latest, if there is anything new
#   sff-deploy --force      rebuild and redeploy even if nothing changed
#   sff-deploy --rollback   put the previous build back
set -Eeuo pipefail

APP_DIR="/home/sendfilesfree/sendfilesfree"
APP_USER="sendfilesfree"
SERVICE="sharefilesfree"
HEALTH_URL="http://127.0.0.1:3000/"
HEALTH_ATTEMPTS=40

BUILD_DIR=".next-incoming"
LIVE_DIR=".next"
PREV_DIR=".next-previous"

bold=$(tput bold 2>/dev/null || true)
plain=$(tput sgr0 2>/dev/null || true)
log() { printf '%s==>%s %s\n' "$bold" "$plain" "$*"; }
die() { printf 'deploy failed: %s\n' "$*" >&2; exit 1; }

as_app() { sudo -u "$APP_USER" "$@"; }

[[ ${EUID:-$(id -u)} -eq 0 ]] || die "run as root (it restarts a systemd unit)"
cd "$APP_DIR" || die "no checkout at $APP_DIR"

# --- wait for the app to answer, or give up -------------------------------
wait_for_health() {
  for _ in $(seq 1 "$HEALTH_ATTEMPTS"); do
    if [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 3 "$HEALTH_URL" || true)" == "200" ]]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# --- rollback -------------------------------------------------------------
if [[ "${1:-}" == "--rollback" ]]; then
  [[ -d "$PREV_DIR" ]] || die "no previous build kept at $APP_DIR/$PREV_DIR"
  log "Putting the previous build back"
  as_app rm -rf "$LIVE_DIR"
  as_app mv "$PREV_DIR" "$LIVE_DIR"
  systemctl restart "$SERVICE"
  wait_for_health || die "the previous build didn't come up either — check: journalctl -u $SERVICE -n 50"
  log "Rolled back. NOTE: the git checkout is still on the newer commit; the"
  log "     served build is the older one. Reconcile before deploying again."
  exit 0
fi

FORCE=false
[[ "${1:-}" == "--force" ]] && FORCE=true

# --- fetch ----------------------------------------------------------------
log "Fetching"
as_app git fetch --quiet origin

BRANCH=$(as_app git rev-parse --abbrev-ref HEAD)
LOCAL=$(as_app git rev-parse HEAD)
REMOTE=$(as_app git rev-parse "origin/$BRANCH")

if [[ "$LOCAL" == "$REMOTE" && "$FORCE" != true ]]; then
  log "Already on $(as_app git log --oneline -1). Nothing to deploy — use --force to rebuild anyway."
  exit 0
fi

# --ff-only so a deploy can never quietly create a merge commit on the server.
as_app git merge --ff-only --quiet "origin/$BRANCH" \
  || die "cannot fast-forward — the server checkout has diverged from origin/$BRANCH"
log "Now on $(as_app git log --oneline -1)"

# --- dependencies ---------------------------------------------------------
log "Installing dependencies"
as_app npm ci --no-audit --no-fund

# --- build, out of the way of the running server --------------------------
log "Building into $BUILD_DIR (the live build keeps serving throughout)"
as_app rm -rf "$BUILD_DIR"
as_app env NEXT_DIST_DIR="$BUILD_DIR" npm run build

# A build that fails partway can still leave a directory behind, so check for
# the artefact that only exists when it finished.
[[ -f "$BUILD_DIR/BUILD_ID" ]] || die "build produced no BUILD_ID — nothing was swapped, the site is untouched"

# --- swap -----------------------------------------------------------------
log "Swapping the new build in"
as_app rm -rf "$PREV_DIR"
[[ -d "$LIVE_DIR" ]] && as_app mv "$LIVE_DIR" "$PREV_DIR"
as_app mv "$BUILD_DIR" "$LIVE_DIR"

log "Restarting $SERVICE"
systemctl restart "$SERVICE"

# --- verify, and undo if it didn't work -----------------------------------
if wait_for_health; then
  log "Healthy. Serving $(as_app git log --oneline -1)"
  log "Previous build kept at $APP_DIR/$PREV_DIR — 'sff-deploy --rollback' restores it."
else
  log "The new build did not answer. Rolling back."
  as_app rm -rf "$LIVE_DIR"
  as_app mv "$PREV_DIR" "$LIVE_DIR"
  systemctl restart "$SERVICE"
  wait_for_health \
    && die "rolled back to the previous build, which is serving. Check: journalctl -u $SERVICE -n 50" \
    || die "rollback also failed to come up. Check: journalctl -u $SERVICE -n 50"
fi

# Restart signaling only when its own source changed — it holds live rooms, and
# restarting it drops every transfer currently being set up.
if ! as_app git diff --quiet "$LOCAL" HEAD -- server/; then
  log "server/ changed — restarting signaling (this drops rooms mid-handshake)"
  systemctl restart signaling
fi

log "Done."
