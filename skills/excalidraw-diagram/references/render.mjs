#!/usr/bin/env node
// Render an Excalidraw skeleton (*.skel.json) or a full .excalidraw file to PNG with the system Chrome.
// Usage: node render.mjs <input> [--out file.png] [--scale 2] [--svg] [--force]
// A skeleton writes <name>.excalidraw next to it; that file is never overwritten once edited in Excalidraw (unless --force).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, basename, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const input = args.find((a, i) => !a.startsWith("--") && !["--out", "--scale"].includes(args[i - 1]));
if (!input) { console.error("Usage: node render.mjs <file.skel.json | file.excalidraw> [--out file.png] [--scale 2] [--svg] [--force]"); process.exit(1); }

const inPath = resolve(input);
const stem = join(dirname(inPath), basename(inPath).replace(/(\.skel)?\.json$|\.excalidraw$/, ""));
const pngPath = resolve(opt("--out", `${stem}.png`));
const scale = Number(opt("--scale", "2"));

let data;
try { data = JSON.parse(readFileSync(inPath, "utf8")); }
catch (e) { console.error(`ERROR: cannot read JSON from ${inPath}: ${e.message}`); process.exit(1); }
const isFull = data && data.type === "excalidraw";
const exPath = `${stem}.excalidraw`;
const sha = (els) => createHash("sha256").update(JSON.stringify(els)).digest("hex");
if (!isFull && existsSync(exPath) && !args.includes("--force")) {
  let prev = null;
  try { prev = JSON.parse(readFileSync(exPath, "utf8")); } catch {}
  if (!prev || prev["x-skel-sha256"] !== sha(prev.elements)) {
    console.error(`ERROR: ${exPath} has been edited outside this renderer (e.g. in Excalidraw).`);
    console.error(`Rendering ${basename(inPath)} would overwrite those edits. Edit and render the .excalidraw file instead, or pass --force.`);
    process.exit(1);
  }
}

const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" };
let browser;
try { browser = await chromium.launch({ headless: true, ...launchOpts }); }
catch (e) {
  console.error("ERROR: could not launch Google Chrome. Install Chrome, or set CHROME_PATH to a Chrome/Chromium binary.");
  console.error(e.message.split("\n")[0]);
  process.exit(1);
}
const problems = [];
try {
  const page = await (await browser.newContext({ deviceScaleFactor: scale })).newPage();
  page.on("response", (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()} ${r.url()}`); });
  page.on("pageerror", (e) => problems.push(`page error: ${e.message}`));
  await page.goto(pathToFileURL(join(here, "render_template.html")).href);
  const ready = await page.waitForFunction(() => window.__moduleReady === true, null, { timeout: 60000 }).then(() => true, () => false);
  if (!ready) throw new Error(`Excalidraw failed to load from esm.sh (network or CDN problem).\n  ${problems.join("\n  ")}`);

  const res = await page.evaluate((d) => window.renderScene(d), data);
  if (!res.ok) throw new Error(`render failed: ${res.error}`);
  await (await page.$("#root svg")).screenshot({ path: pngPath, omitBackground: false });

  const written = [pngPath];
  if (!isFull) {
    const doc = JSON.parse(res.excalidraw);
    doc["x-skel-sha256"] = sha(doc.elements);  // lets the next run detect manual edits
    writeFileSync(exPath, JSON.stringify(doc, null, 2));
    written.unshift(exPath);
  }
  if (args.includes("--svg")) { writeFileSync(`${stem}.svg`, res.svg); written.push(`${stem}.svg`); }
  for (const f of written) console.log(`wrote ${f}`);
  if (res.issues.length) {
    console.log(`\nLINT: ${res.issues.length} issue(s) — fix in the source and re-render:`);
    for (const i of res.issues) console.log(`  - ${i}`);
  } else console.log("\nLINT: no geometry issues found (still inspect the PNG).");
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  process.exitCode = 1;
} finally {
  await browser.close();
}
