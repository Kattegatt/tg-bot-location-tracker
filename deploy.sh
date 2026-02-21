#!/usr/bin/env bash
set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/srv/communitymap}"

cd "$DEPLOY_DIR"

DEFAULT_BRANCH="$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's@^origin/@@' || true)"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-${DEFAULT_BRANCH:-main}}"

git fetch --all
git reset --hard "origin/${DEPLOY_BRANCH}"

./build-webapp.sh

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build

# Optional, non-blocking migration step.
docker compose --env-file .env.prod -f docker-compose.prod.yml exec -T api npm run db:migrate || true

echo "Deployment finished for branch ${DEPLOY_BRANCH}"
