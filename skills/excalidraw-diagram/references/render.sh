#!/usr/bin/env bash
# Runs render.mjs with local JavaScript and fonts. First use downloads locked npm packages and
# builds the browser bundle; later renders (including this readiness check) work offline.
# usage: render.sh <file.skel.json | file.excalidraw> [--out file.png] [--scale 2] [--svg] [--force]
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
command -v node >/dev/null 2>&1 || { echo 'ERROR: node not found. Install Node.js 20 or later.' >&2; exit 1; }
if (($(node -p 'process.versions.node.split(".")[0]') < 20)); then
  echo "ERROR: Node.js 20 or later is required; found $(node -v)." >&2
  exit 1
fi
if ! node "$here/setup.mjs" --check; then
  node "$here/setup.mjs" >&2
fi
exec node "$here/render.mjs" "$@"
