import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// A virtual origin served entirely from disk by Playwright; no HTTP server or network connection.
const origin = "http://127.0.0.1";
const types = { ".html": "text/html", ".js": "text/javascript", ".woff2": "font/woff2" };

export async function openLocalPage(browser, scale = 2) {
  const context = await browser.newContext({ deviceScaleFactor: scale, offline: true, serviceWorkers: "block" });
  const problems = [];
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const path = decodeURIComponent(url.pathname);
    if (url.origin !== origin || path.split("/").includes("..")
      || !(path === "/render_template.html" || path.startsWith("/vendor/"))) {
      problems.push(`Unexpected resource: ${url.href}`);
      await route.abort();
      return;
    }
    try {
      await route.fulfill({ body: await readFile(join(here, path.slice(1))), contentType: types[extname(path)] || "application/octet-stream" });
    } catch (error) {
      problems.push(`Cannot load local resource ${path}: ${error.message}`);
      await route.abort();
    }
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  await page.goto(`${origin}/render_template.html`);
  const ready = await page.waitForFunction(() => window.__moduleReady === true, null, { timeout: 10000 }).then(() => true, () => false);
  if (!ready) {
    await context.close();
    throw new Error(`Local Excalidraw failed to load. Run npm run setup in ${here}.\n  ${problems.join("\n  ")}`);
  }
  return { context, page, problems };
}
