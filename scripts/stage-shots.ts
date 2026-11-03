/**
 * Timed screenshots of the live stage during one page load (6.3 beats checked by eye).
 *   npx tsx --env-file=.env scripts/stage-shots.ts http://127.0.0.1:3100 /replay/<id> [--phone | --4k] [--at 3,15,25,40] [--presenter]
 * Output: $DATA_DIR/out/screens/stage-<slug>-<w>-<t>s.png; prints page errors.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, route = "/live", ...rest] = process.argv.slice(2);
if (!base) throw new Error("usage: stage-shots.ts <baseUrl> <route> [--phone | --4k] [--at 3,15,25,40]");
const token = process.env.ACCESS_TOKEN;
const dataDir = process.env.DATA_DIR;
if (!token || !dataDir) throw new Error("ACCESS_TOKEN / DATA_DIR not set");
const phone = rest.includes("--phone");
const ai = rest.indexOf("--at");
const times = (ai >= 0 ? rest[ai + 1] : "3,15,25,40").split(",").map(Number);
const outDir = path.join(dataDir, "out", "screens");
mkdirSync(outDir, { recursive: true });
const slug = route.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 40) || "home";
const wide = rest.includes("--4k");
const vp = phone ? { width: 390, height: 844 } : wide ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 };

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone });
  const u = new URL(base);
  await ctx.addCookies([{ name: "tsumugi_token", value: token, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
  if (rest.includes("--presenter") && process.env.PRESENTER_TOKEN) {
    await ctx.addCookies([{ name: "tsumugi_presenter", value: process.env.PRESENTER_TOKEN, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
  }
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const t0 = Date.now();
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  for (const t of times) {
    const wait = t * 1000 - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    const file = path.join(outDir, `stage-${slug}-${vp.width}-${t}s.png`);
    await page.screenshot({ path: file, fullPage: rest.includes("--full") });
    console.log(file);
  }
  console.log(JSON.stringify({ errors: errors.slice(0, 8) }));
} finally {
  await browser.close();
}
