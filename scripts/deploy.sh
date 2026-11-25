#!/bin/sh
# Deploy current branch to VPS: push, then git sync + rebuild on the server.
# Config: VPS_SSH="user@host" VPS_DIR="/opt/fatsecret-mcp" npm run deploy
set -eu

: "${VPS_SSH:?Set VPS_SSH, e.g. user@host}"
: "${VPS_DIR:?Set VPS_DIR, e.g. /opt/fatsecret-mcp}"

BRANCH=$(git rev-parse --abbrev-ref HEAD)
git push origin "$BRANCH"

# VPS copy is a clean mirror: local edits there are discarded (.env and ./data are
# git-ignored, so config and tokens survive). --build picks up the actual version.
# Picks docker compose v2 or legacy docker-compose, whichever exists on the server.
ssh "$VPS_SSH" "cd '$VPS_DIR' && git fetch origin && git checkout '$BRANCH' && git reset --hard 'origin/$BRANCH' && if docker compose version >/dev/null 2>&1; then DC='docker compose'; else DC='docker-compose'; fi && \$DC up -d --build && \$DC ps"
