#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  npm ci
fi

# Optional production env loading.
if [ -f .env.prod ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.prod
  set +a
fi

# Prefer explicit VITE_API_URL; otherwise derive from API_DOMAIN.
if [ -z "${VITE_API_URL:-}" ] && [ -n "${API_DOMAIN:-}" ]; then
  export VITE_API_URL="https://${API_DOMAIN}"
fi

npm -w apps/webapp run build

rm -rf webapp-dist
mkdir -p webapp-dist
cp -R apps/webapp/dist/. webapp-dist/

echo "WebApp build prepared in $ROOT_DIR/webapp-dist (VITE_API_URL=${VITE_API_URL:-auto})"
