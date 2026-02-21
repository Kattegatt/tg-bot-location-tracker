#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

if [ ! -d node_modules ]; then
  npm ci
fi

npm -w apps/webapp run build

rm -rf webapp-dist
mkdir -p webapp-dist
cp -R apps/webapp/dist/. webapp-dist/

echo "WebApp build prepared in $ROOT_DIR/webapp-dist"

