#!/usr/bin/env bash
# Runs render.mjs, installing its one dependency (playwright-core) on first use. A plugin update
# replaces this folder, so the install happens again after one.
# usage: render.sh <file.skel.json | file.excalidraw> [--out file.png] [--scale 2] [--svg] [--force]
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
command -v node >/dev/null 2>&1 || { echo 'ERROR: node not found. Install Node.js 18 or later.' >&2; exit 1; }
if [[ ! -d $here/node_modules/playwright-core ]]; then
  echo 'installing playwright-core (first run)...' >&2
  (cd "$here" && npm install --ignore-scripts --no-audit --no-fund --loglevel=error) >&2
fi
exec node "$here/render.mjs" "$@"
