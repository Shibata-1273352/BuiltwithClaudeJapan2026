/**
 * FR-47 E2E: replay a recorded exploration (no Claude call). Checks that the "recording" banner is
 * shown from the start, the original flow plays to the end, and presentation mode can replay too.
 *   npx tsx --env-file=.env scripts/e2e-replay.ts http://127.0.0.1:3100 <exploration id>
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, id] = process.argv.slice(2);
if (!base || !id) throw new Error("usage: e2e-replay.ts <baseUrl> <exploration id>");
const outDir = path.join(process.env.DATA_DIR!, "out", "replay");
mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
const host = new URL(base).hostname;
await ctx.addCookies([
  { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: host, path: "/", httpOnly: true, sameSite: "Strict" },
  { name: "tsumugi_presenter", value: process.env.PRESENTER_TOKEN!, domain: host, path: "/", httpOnly: true, sameSite: "Strict" },
]);
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
const t0 = Date.now();
await page.goto(`${base}/replay/${id}?view=list`, { waitUntil: "domcontentloaded" });
const banner = await page.getByTestId("replay-banner").textContent({ timeout: 10_000 });
const statusEarly = await page.getByTestId("exploration-status").textContent();
await page.waitForFunction(() => document.querySelector('[data-testid="exploration-status"]')?.textContent?.includes("完了"), null, { timeout: 120_000 });
const ms = Date.now() - t0;
const hasNarrative = (await page.getByTestId("narrative").count()) > 0;
const hasVisual = (await page.getByTestId("visual").count()) > 0;
const bannerAtEnd = await page.getByTestId("replay-banner").isVisible();
await page.screenshot({ path: path.join(outDir, "replay.png"), fullPage: true });
// FR-27: tap a name in 言の地層 and compare how each source writes it (pick the entity with most usages)
let compare: { en: number; ja: number } | null = null;
const chips = page.getByTestId("name-chip");
if (await chips.count()) {
  const n = await chips.count();
  for (let i = 0; i < n && !compare; i++) {
    await chips.nth(i).click();
    const box = page.getByTestId("name-compare");
    const txt = (await box.innerText().catch(() => "")) ?? "";
    const en = Number(/English（(\d+)）/.exec(txt)?.[1] ?? 0);
    const ja = Number(/日本語（(\d+)）/.exec(txt)?.[1] ?? 0);
    if (en > 0 && ja > 0) {
      compare = { en, ja };
      await box.screenshot({ path: path.join(outDir, "name-compare.png") });
    } else await chips.nth(i).click();
  }
}

const p2 = await ctx.newPage();
await p2.goto(`${base}/present?replay=${id}`, { waitUntil: "domcontentloaded" });
const presentBanner = await p2.getByTestId("replay-banner").textContent({ timeout: 10_000 });
await p2.waitForFunction(() => /秒/.test(document.querySelector('[data-testid="present-totals"]')?.textContent ?? ""), null, { timeout: 120_000 });
await p2.screenshot({ path: path.join(outDir, "present-replay.png") });
console.log(JSON.stringify({ banner, statusEarly, ms, hasNarrative, hasVisual, bannerAtEnd, compare, presentBanner, errors }, null, 2));
await browser.close();
