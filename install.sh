#!/usr/bin/env bash
# Installs the excalidraw-diagram plugin of this repository and everything it needs: Node.js 18+,
# Google Chrome (or Chromium), and a Chinese font on Linux. Then it adds this repository as a plugin
# marketplace, installs the plugin, and renders the example flowchart to prove the setup works.
#
# usage: ./install.sh [options]
#   --check            only report what is missing; change nothing
#   --source <src>     marketplace source for `claude plugin marketplace add`
#                      (default: this clone's GitHub origin, else this folder)
#   --skip-deps        do not install system software
#   --skip-plugin      do not touch Claude Code plugins or settings
#   -h, --help
#
# It is safe to run again. It runs without a terminal (from an agent): a command that needs root
# uses sudo without a password when it can, and otherwise stops and prints the command to run by hand.
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
MARKET=claude-excalidraw-diagram
ID=excalidraw-diagram@$MARKET
OLD_SKILL=$HOME/.claude/skills/excalidraw-diagram
check=0 source='' skip_deps=0 skip_plugin=0

while (($#)); do
  case $1 in
    --check) check=1 ;;
    --source) source=${2:?}; shift ;;
    --skip-deps) skip_deps=1 ;;
    --skip-plugin) skip_plugin=1 ;;
    -h | --help) sed -n '2,15p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

failures=()
say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$*"; failures+=("$*"); }
have() { command -v "$1" >/dev/null 2>&1; }

os=$(uname -s)
pm=''
if [[ $os == Darwin ]]; then pm=brew
elif have apt-get; then pm=apt
elif have pacman; then pm=pacman
elif have dnf; then pm=dnf
fi
[[ -x /opt/homebrew/bin/brew && :$PATH: != *:/opt/homebrew/bin:* ]] && PATH=/opt/homebrew/bin:$PATH
export PATH

as_root() {
  if [[ $(id -u) == 0 ]]; then "$@"
  elif sudo -n true 2>/dev/null; then sudo "$@"
  elif [[ -t 0 ]]; then sudo "$@"
  else
    bad "needs root; run this by hand, then run install.sh again: sudo $*"
    return 1
  fi
}

# ---------- Node.js, Chrome, fonts ---------------------------------------------------------------

chrome_path=''
find_chrome() {
  chrome_path=''
  if [[ -n ${CHROME_PATH:-} && -x ${CHROME_PATH:-} ]]; then chrome_path=$CHROME_PATH; return 0; fi
  if [[ $os == Darwin ]]; then
    [[ -d "/Applications/Google Chrome.app" || -d "$HOME/Applications/Google Chrome.app" ]]
    return
  fi
  # playwright's "chrome" channel finds Google Chrome at /opt/google/chrome; others need CHROME_PATH.
  [[ -x /opt/google/chrome/chrome ]] && return 0
  local c
  for c in chromium chromium-browser google-chrome-stable google-chrome; do
    if have "$c"; then chrome_path=$(command -v "$c"); return 0; fi
  done
  return 1
}

node_ok() { have node && have npm && (($(node -p 'process.versions.node.split(".")[0]') >= 18)); }

# macOS has PingFang; Linux needs a font that fontconfig lists for Chinese.
cjk_font_ok() {
  [[ $os == Darwin ]] && return 0
  have fc-list && [[ -n $(fc-list :lang=zh family 2>/dev/null) ]]
}

report() {
  local need=0
  if node_ok; then ok "node $(node -v)"; else warn 'Node.js 18+ with npm missing'; need=1; fi
  if find_chrome; then ok "chrome ${chrome_path:-(Google Chrome)}"; else warn 'Chrome/Chromium missing'; need=1; fi
  if cjk_font_ok; then ok 'Chinese font'; else warn 'no Chinese font (fc-list :lang=zh is empty)'; need=1; fi
  return $need
}

install_deps() {
  say 'Node.js, Chrome, Chinese font'
  local need=0
  report || need=1
  if have curl; then
    if curl -fsS -o /dev/null --max-time 20 'https://esm.sh/@excalidraw/excalidraw@0.18.1'; then ok 'esm.sh reachable'
    else warn 'esm.sh not reachable; the renderer loads Excalidraw from it (check the proxy)'
    fi
  fi
  ((need && !check)) || return 0
  case $pm in
    brew)
      have brew || { bad 'Homebrew not found; install it from https://brew.sh and run again'; return 0; }
      node_ok || brew install node
      find_chrome || brew install --cask google-chrome
      ;;
    apt)
      as_root apt-get update -qq || true
      node_ok || as_root apt-get install -y nodejs npm || true
      find_chrome || as_root apt-get install -y chromium || as_root apt-get install -y chromium-browser || true
      cjk_font_ok || as_root apt-get install -y fonts-noto-cjk fontconfig || true
      ;;
    pacman)
      as_root pacman -S --needed --noconfirm nodejs npm chromium noto-fonts-cjk || true
      ;;
    dnf)
      as_root dnf install -y nodejs npm chromium google-noto-sans-cjk-fonts || true
      ;;
    *) ;;
  esac
  hash -r
  node_ok || bad 'Node.js 18+ still missing: see https://nodejs.org/en/download'
  find_chrome || bad 'Chrome still missing: install it from https://www.google.com/chrome/'
  cjk_font_ok || bad 'Chinese font still missing: install Noto Sans CJK'
  return 0
}

# ---------- Claude Code --------------------------------------------------------------------------

CLAUDE=$(command -v claude 2>/dev/null || true)
[[ -n $CLAUDE ]] || CLAUDE=$HOME/.local/bin/claude

# Prints the install path of plugin id $1, empty when it is not installed.
plugin_path() {
  "$CLAUDE" plugin list --json 2>/dev/null | node -e '
    let s = ""; process.stdin.on("data", d => s += d).on("end", () => {
      const p = JSON.parse(s).find(p => p.id === process.argv[1]); if (p) console.log(p.installPath) })' "$1" 2>/dev/null || true
}

# set_env KEY VALUE: writes env.KEY into ~/.claude/settings.json.
set_env() {
  mkdir -p "$HOME/.claude"
  node -e '
    const fs = require("fs"), [f, k, v] = process.argv.slice(1)
    const s = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : {}
    if ((s.env ??= {})[k] === v) process.exit(0)
    s.env[k] = v
    fs.writeFileSync(f, JSON.stringify(s, null, 2) + "\n")' "$HOME/.claude/settings.json" "$1" "$2"
}

install_plugin() {
  say 'Claude Code plugin'
  [[ -x $CLAUDE ]] || have claude || { bad 'claude CLI not found'; return 0; }
  have node || { bad 'node is needed to read and edit Claude Code settings'; return 0; }
  if ((check)); then
    if [[ -n $(plugin_path "$ID") ]]; then ok "$ID installed"; else warn "$ID not installed"; fi
    [[ ! -d $OLD_SKILL ]] || warn "$OLD_SKILL also defines the skill"
    return 0
  fi

  if [[ -z $source ]]; then
    local url
    url=$(git -C "$here" remote get-url origin 2>/dev/null || true)
    if [[ $url =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then source=${BASH_REMATCH[1]}; else source=$here; fi
  fi
  if "$CLAUDE" plugin marketplace list 2>/dev/null | grep -q "$MARKET"; then
    "$CLAUDE" plugin marketplace update "$MARKET" >/dev/null && ok "marketplace $MARKET updated"
  else
    if "$CLAUDE" plugin marketplace add "$source" >/dev/null; then ok "marketplace $MARKET added from $source"
    else bad "claude plugin marketplace add $source failed"; return 0
    fi
  fi

  # A skill of the same name in ~/.claude/skills would shadow or duplicate the plugin's.
  if [[ -d $OLD_SKILL ]]; then
    mkdir -p "$HOME/.claude/skills-backup"
    local dest
    dest=$HOME/.claude/skills-backup/excalidraw-diagram-$(date +%Y%m%d%H%M%S)
    mv "$OLD_SKILL" "$dest" && ok "moved the old $OLD_SKILL to $dest (the plugin replaces it)"
  fi

  if [[ -n $(plugin_path "$ID") ]]; then
    "$CLAUDE" plugin update "$ID" >/dev/null 2>&1 || true
    "$CLAUDE" plugin enable "$ID" >/dev/null 2>&1 || true
    ok "$ID already installed; updated"
  else
    if "$CLAUDE" plugin install "$ID" >/dev/null; then ok "$ID installed"
    else bad "claude plugin install $ID failed"; return 0
    fi
  fi
  find_chrome || true
  if [[ -n $chrome_path ]]; then
    set_env CHROME_PATH "$chrome_path" && ok "settings.json env CHROME_PATH=$chrome_path"
  fi
  return 0
}

# Renders the example, which also installs playwright-core into the installed plugin.
verify() {
  say 'Test render'
  local tmp root out
  tmp=$(mktemp -d)
  root=$(plugin_path "$ID")
  [[ -n $root ]] || root=$here
  local refs=$root/skills/excalidraw-diagram/references
  cp "$refs/example-flowchart.skel.json" "$tmp/"
  find_chrome || true
  if out=$(CHROME_PATH=${chrome_path:-${CHROME_PATH:-}} bash "$refs/render.sh" "$tmp/example-flowchart.skel.json" 2>&1); then
    ok "diagram rendered: $tmp/example-flowchart.png"
  else
    bad "render failed: $(tail -3 <<<"$out")"
  fi
}

# ---------- main ---------------------------------------------------------------------------------

if ((check || !skip_deps)); then install_deps; fi
((skip_plugin)) || install_plugin
((check)) || verify

echo
if ((${#failures[@]})); then
  say "Finished with ${#failures[@]} problem(s):"
  printf '  - %s\n' "${failures[@]}"
  exit 1
fi
if ((check)); then say 'Check done.'
else say 'Done. Start a new Claude Code session (or run /reload-plugins) to load the plugin.'
fi
