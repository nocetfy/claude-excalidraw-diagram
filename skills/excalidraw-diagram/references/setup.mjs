#!/usr/bin/env node
// Prepare locked npm dependencies and browser assets once; render.sh only checks local files after that.
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

if (Number(process.versions.node.split(".")[0]) < 20) {
  console.error(`ERROR: Node.js 20 or later is required; found ${process.version}.`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const vendor = join(here, "vendor");
const hash = (names) => {
  const h = createHash("sha256");
  for (const name of names) h.update(name).update(readFileSync(join(here, name)));
  return h.digest("hex");
};
const lockHash = hash(["package.json", "package-lock.json"]);
const buildHash = hash(["package.json", "package-lock.json", "setup.mjs", "render-scene.mjs"]);
const stamp = join(here, "node_modules", ".renderer-lock");
const installed = () => existsSync(stamp) && readFileSync(stamp, "utf8") === lockHash
  && ["playwright-core", "esbuild", "@excalidraw/excalidraw", "react", "react-dom"]
    .every((name) => existsSync(join(here, "node_modules", name, "package.json")));

function ready() {
  try {
    const manifest = JSON.parse(readFileSync(join(vendor, "manifest.json"), "utf8"));
    return installed() && manifest.buildHash === buildHash && manifest.files.length > 0
      && manifest.files.every((file) => existsSync(join(vendor, file)));
  } catch { return false; }
}

if (process.argv.includes("--check")) process.exit(ready() ? 0 : 1);
if (ready()) {
  console.log("Local renderer is ready (no download needed).");
  process.exit(0);
}

if (!installed()) {
  console.log("Installing locked renderer dependencies from npm (one-time setup)...");
  const env = { ...process.env };
  // npm ignores all_proxy, although curl and many desktop setups use it.
  const proxy = env.all_proxy || env.ALL_PROXY;
  if (!env.https_proxy && !env.HTTPS_PROXY && /^https?:\/\//i.test(proxy || "")) env.https_proxy = proxy;
  const result = spawnSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund", "--maxsockets=4"], {
    cwd: here, stdio: "inherit", env,
  });
  if (result.error || result.status !== 0) {
    console.error("ERROR: npm setup failed. Check npm registry access and rerun npm run setup.");
    process.exit(1);
  }
  writeFileSync(stamp, lockHash);
}

const { build } = await import("esbuild");
const staging = mkdtempSync(join(here, ".vendor-"));
const excalidraw = join(here, "node_modules", "@excalidraw", "excalidraw", "dist", "prod");
const options = {
  absWorkingDir: here, bundle: true, format: "esm", platform: "browser", target: "es2022",
  minify: true, legalComments: "linked", define: { "process.env.NODE_ENV": '"production"' },
};
try {
  // Keep the font subset worker in its own module: its import.meta.url must identify the worker.
  await build({ ...options, entryPoints: [join(excalidraw, "subset-worker.chunk.js")], outfile: join(staging, "subset-worker.js") });
  await build({
    ...options, entryPoints: ["render-scene.mjs"], outfile: join(staging, "renderer.js"),
    plugins: [{ name: "local-font-worker", setup(builder) {
      builder.onResolve({ filter: /\/subset-worker\.chunk\.js$/ }, () => ({ path: "./subset-worker.js", external: true }));
    } }],
  });
  cpSync(join(excalidraw, "fonts"), join(staging, "fonts"), { recursive: true });
  const listFiles = (dir, prefix = "") => readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? listFiles(join(dir, e.name), `${prefix}${e.name}/`) : [`${prefix}${e.name}`]);
  writeFileSync(join(staging, "manifest.json"), JSON.stringify({ buildHash, files: listFiles(staging) }, null, 2) + "\n");
  rmSync(vendor, { recursive: true, force: true });
  renameSync(staging, vendor);
  console.log("Local renderer and fonts prepared. Rendering no longer needs network access.");
} finally {
  rmSync(staging, { recursive: true, force: true });
}
