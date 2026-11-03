/**
 * 絵の中へ by screenshot (no Claude): open /space/<scene>?enter=1, wait for the camera to arrive and
 * the print to open into depth, then lean with the pointer (parallax) — one frame each.
 *   npx tsx --env-file=.env scripts/space-shot.ts http://127.0.0.1:3200 <scene id> [--lang en]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, scene, ...rest] = process.argv.slice(2);
if (!base || !scene) throw new Error("usage: space-shot.ts <baseUrl> <scene id> [--lang en]");
const lang = rest.includes("--lang") ? rest[rest.indexOf("--lang") + 1] : "ja";
const out = path.join(process.env.DATA_DIR!, "out", "screens", "space");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const fails: string[] = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const u = new URL(base);
  await ctx.addCookies([
    { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
    { name: "tsumugi_lang", value: lang, domain: u.hostname, path: "/" },
    { name: "tsumugi_presenter", value: process.env.PRESENTER_TOKEN!, domain: u.hostname, path: "/" },
  ]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.goto(`${base}/space/${scene}?enter=1&3d=1`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.locator("canvas").first().waitFor({ timeout: 60_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, `${lang}-1-split.png`) });
  await page.waitForTimeout(9000); // 1.8 s + the 1.6 s move + the 1.2 s opening (slow on a software renderer)
  const box = (await page.locator("canvas").first().boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(out, `${lang}-2-inside.png`) });
  await page.mouse.move(box.x + box.width * 0.05, box.y + box.height * 0.1, { steps: 10 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `${lang}-3-lean-left.png`) });
  await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.9, { steps: 10 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(out, `${lang}-4-lean-right.png`) });
  if (errors.length) fails.push(...errors.slice(0, 3));
  console.log(JSON.stringify({ out, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
