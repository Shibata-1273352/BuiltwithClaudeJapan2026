/**
 * Headless screenshots of a page for visual checks (software WebGL; fps here is not representative).
 *   npx tsx --env-file=.env scripts/screenshot.ts http://127.0.0.1:3100 /space/kaminarimon_cc0 [--overlay 0.6]
 * Output: $DATA_DIR/out/screens/<slug>[-overlay].png
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, route = "/", ...rest] = process.argv.slice(2);
if (!base) throw new Error("usage: screenshot.ts <baseUrl> <route> [--overlay n]");
const token = process.env.ACCESS_TOKEN;
const dataDir = process.env.DATA_DIR;
if (!token || !dataDir) throw new Error("ACCESS_TOKEN / DATA_DIR not set");
const oi = rest.indexOf("--overlay");
const overlay = oi >= 0 ? Number(rest[oi + 1]) : null;

const outDir = path.join(dataDir, "out", "screens");
mkdirSync(outDir, { recursive: true });
const slug = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "home";

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  // The cookie is Secure; set it directly for the http://127.0.0.1 test server.
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const u = new URL(base);
  await ctx.addCookies([{ name: "tsumugi_token", value: token, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(base + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(outDir, `${slug}.png`) });
  // --fill testid=value (e.g. --fill year-slider=1878), then screenshot as <slug>-<value>.png
  const fi = rest.indexOf("--fill");
  if (fi >= 0) {
    const [tid, value] = rest[fi + 1].split("=");
    await page.getByTestId(tid).fill(value);
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(outDir, `${slug}-${value}.png`) });
  }
  if (rest.includes("--orbit")) {
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + 70, cy - 15, { steps: 12 });
      await page.mouse.up();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, `${slug}-orbit.png`) });
    }
  }
  if (overlay !== null) {
    await page.locator('input[type="range"]').fill(String(overlay));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(outDir, `${slug}-overlay.png`) });
  }
  const fps = await page.locator("text=/\\d+ fps/").textContent().catch(() => null);
  console.log(JSON.stringify({ saved: outDir, slug, fps, errors }, null, 2));
} finally {
  await browser.close();
}
