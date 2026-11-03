import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { chromium } from "playwright-core";
import { openLocalPage } from "./local-page.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const launchOpts = process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: "chrome" };

test("renders a Chinese diagram and embedded fonts with the browser offline", async () => {
  const browser = await chromium.launch({ headless: true, ...launchOpts });
  try {
    const { page, context, problems } = await openLocalPage(browser);
    assert.equal(await page.evaluate(() => navigator.onLine), false);
    const requests = [];
    context.on("request", (request) => requests.push(request.url()));
    const input = JSON.parse(readFileSync(join(here, "example-flowchart.skel.json"), "utf8"));
    const res = await page.evaluate((data) => window.renderScene(data), input);
    assert.equal(res.ok, true, res.error);
    assert.deepEqual(res.issues, []);
    assert.match(res.svg, /支付/);
    assert.equal(JSON.parse(res.excalidraw).type, "excalidraw");

    // Exercise web fonts, their worker, and SVG font embedding, not just system Helvetica.
    const fonts = [1, 3, 5, 6, 7, 8].map((fontFamily, i) => ({
      type: "text", id: `font-${fontFamily}`, x: 0, y: i * 60,
      text: `Local font ${fontFamily}`, fontFamily, fontSize: 24,
    }));
    const fontResult = await page.evaluate((data) => window.renderScene(data), fonts);
    assert.equal(fontResult.ok, true, fontResult.error);
    await page.evaluate(() => document.fonts.ready);
    assert.match(fontResult.svg, /data:font\/woff2;base64,/);
    assert.ok(requests.some((url) => url.endsWith(".woff2")), "font files should load locally");
    assert.ok(requests.some((url) => url.endsWith("subset-worker.js")), "font subset worker should load locally");
    assert.ok(requests.every((url) => new URL(url).origin === "http://127.0.0.1"), requests.join("\n"));
    assert.deepEqual(problems, []);
    const png = await page.locator("#root svg").screenshot();
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  } finally { await browser.close(); }
});

test("CLI reuses local assets, exports PNG/SVG, and preserves manually edited scenes", () => {
  const dir = mkdtempSync(join(tmpdir(), "excalidraw-offline-test-"));
  try {
    // Fail immediately if the warm renderer tries to reinstall dependencies.
    writeFileSync(join(dir, "npm"), "#!/bin/sh\necho 'unexpected npm download' >&2\nexit 99\n", { mode: 0o755 });
    const input = join(dir, "diagram.skel.json");
    writeFileSync(input, readFileSync(join(here, "example-flowchart.skel.json")));
    const run = (...args) => spawnSync("bash", [join(here, "render.sh"), ...args], {
      encoding: "utf8", env: { ...process.env, PATH: `${dir}:${process.env.PATH}` }, timeout: 60000,
    });
    let result = run(input, "--svg");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(join(dir, "diagram.png")).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    const scenePath = join(dir, "diagram.excalidraw");
    const scene = JSON.parse(readFileSync(scenePath, "utf8"));
    const label = scene.elements.find((e) => e.type === "text");
    label.text = label.originalText = "离线修改标签";
    const edited = JSON.stringify(scene);
    writeFileSync(scenePath, edited);
    result = run(input);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /edited outside this renderer/);
    assert.equal(readFileSync(scenePath, "utf8"), edited);
    result = run(scenePath, "--svg");
    assert.equal(result.status, 0, result.stderr);
    assert.match(readFileSync(join(dir, "diagram.svg"), "utf8"), /离线修改标签/);
    assert.equal(readFileSync(scenePath, "utf8"), edited);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
