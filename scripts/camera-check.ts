/**
 * FR-01 with Chromium's fake camera: open the viewfinder, shoot, and get the preprocessed preview
 * (nothing is sent; no Claude call).
 *   npx tsx --env-file=.env scripts/camera-check.ts http://127.0.0.1:3100
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.argv[2];
if (!base) throw new Error("usage: camera-check.ts <baseUrl>");
const out = path.join(process.env.DATA_DIR!, "out", "screens", "camera");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const fails: string[] = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ["camera"] });
  const u = new URL(base);
  await ctx.addCookies([{ name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const open = page.getByTestId("camera-open");
  if (!(await open.count())) fails.push("no camera button");
  else {
    await open.click();
    const shutter = page.getByTestId("camera-shutter");
    await page.waitForFunction(() => !(document.querySelector('[data-testid="camera-shutter"]') as HTMLButtonElement | null)?.disabled, null, { timeout: 15_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, "1-viewfinder.png") });
    await shutter.click();
    await page.getByTestId("camera").waitFor({ state: "detached", timeout: 5_000 }).catch(() => fails.push("the viewfinder did not close"));
    await page.locator("canvas").first().waitFor({ timeout: 30_000 }).catch(() => fails.push("no preview after the shot"));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(out, "2-preview.png") });
  }
  if (errors.length) fails.push(...errors.slice(0, 2));
  console.log(JSON.stringify({ out, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
