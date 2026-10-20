# excalidraw-diagram

**English** | [简体中文](README.zh-CN.md)

A Claude Code plugin that draws technical diagrams: flowcharts, architecture diagrams, sequence diagrams, data flows, state machines and call chains. It writes a PNG and an editable `.excalidraw` file, in a clean style that is not hand-drawn, with semantic colours. It renders on your machine and checks the result for overlaps and lines that cross nodes.

![Example: a payment callback flowchart](docs/example-flowchart.png)

## Install

```bash
git clone https://github.com/nocetfy/claude-excalidraw-diagram.git
cd claude-excalidraw-diagram
./install.sh
```

Then start a new Claude Code session, or run `/reload-plugins`, and ask for a diagram, such as "draw a flowchart of …". You can also tell Claude Code: **"clone https://github.com/nocetfy/claude-excalidraw-diagram and install it as its README says"**.

If Node.js and Chrome are already installed, the plugin alone installs with:

```
/plugin install excalidraw-diagram --marketplace nocetfy/claude-excalidraw-diagram
```

`install.sh` installs only what is missing, and it is safe to run again:

| Dependency | macOS (Homebrew) | Debian, Ubuntu | Arch |
| --- | --- | --- | --- |
| Node.js 18+ | `node` | `nodejs npm` | `nodejs npm` |
| Browser | `google-chrome` | `chromium` | `chromium` |
| Chinese font | PingFang, built in | `fonts-noto-cjk` | `noto-fonts-cjk` |

- It checks that esm.sh is reachable: the renderer loads Excalidraw from it. Behind a firewall, set a proxy.
- It adds the marketplace `claude-excalidraw-diagram` and installs the plugin `excalidraw-diagram`.
- It moves an existing `~/.claude/skills/excalidraw-diagram` to `~/.claude/skills-backup/`, so that two skills of the same name do not clash.
- On Linux with Chromium, it writes `CHROME_PATH` into the `env` block of `~/.claude/settings.json`.
- Last, it renders the example flowchart, which also installs the one npm dependency, playwright-core, to prove the whole chain works.

To only check what is missing, without changing anything: `./install.sh --check`. For the other options: `./install.sh --help`.

### Instructions for an agent

1. Clone this repository and run `./install.sh` at its root.
2. Exit code 0 means success. The `Test render` line gives the path of the example picture; Read it to confirm.
3. On another exit code, read the list under `Finished with N problem(s)` at the end. For a line that says `needs root; run this by hand`, give that `sudo ...` command to the user, who runs it at the prompt as `! sudo ...`; then run `./install.sh` again.
4. Tell the user to start a new session.

## Features

- **Style.** Conventional technical diagrams: semantic colours, straight horizontal and vertical connectors, Helvetica, and steady lines rather than a hand-drawn look.
- **Input format.** The model writes a skeleton file (`.skel.json`). Excalidraw measures the text and centres the labels itself, so Chinese text does not overflow.
- **Renderer.** Node.js with `playwright-core`, driving the Google Chrome already on the machine, so no browser download. Excalidraw loads from esm.sh, at a pinned version.
- **Automatic checks.** Each render checks for overlapping nodes, connectors through nodes, diagonal lines, colliding labels, nodes outside their group, and shapes stretched by their text.
- **Manual edits are kept.** A `.excalidraw` file edited in Excalidraw is not overwritten from the skeleton, unless you pass `--force`.

## Render by hand

```bash
bash skills/excalidraw-diagram/references/render.sh path/to/diagram.skel.json [--svg] [--scale 2] [--force]
bash skills/excalidraw-diagram/references/render.sh path/to/diagram.excalidraw
```

## Requirements

- macOS or Linux. Tested on macOS. The Linux install commands follow each distribution's package names and are not tested.
- Set the environment variable `CHROME_PATH` to use another browser.

## License

MIT
