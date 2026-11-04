/**
 * The landing page's three moments, shot from the real app (the public recording; no Claude call):
 * the opened guide card (read & understand), the time window at the year of the broken thread
 * (across time), the postcard (take it home). Written to apps/web/public/landing/<name>-<lang>.jpg.
 *   npx tsx --env-file=.env scripts/landing-shots.ts http://127.0.0.1:3200 [replay id]
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, idArg] = process.argv.slice(2);
const id = idArg ?? process.env.DEMO_REPLAY_ID!;
if (!base || !id) throw new Error("usage: landing-shots.ts <baseUrl> [replay id]");
const out = path.join(import.meta.dirname, "..", "apps", "web", "public", "landing");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const fails: string[] = [];
try {
  for (const lang of ["ja", "en"]) {
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 }  /* sharp on 4K and Retina */);
    const u = new URL(base);
    await ctx.addCookies([
      { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
      { name: "tsumugi_lang", value: lang, domain: u.hostname, path: "/" },
    ]);
    const page = await ctx.newPage();
    await page.goto(`${base}/replay/${id}?hold=broken`, { waitUntil: "domcontentloaded" }); // the hero does not give away 1878
    await page.getByTestId("note-link").waitFor({ timeout: 120_000 });
    await page.getByTestId("stage-overlay").waitFor({ state: "detached", timeout: 12_000 }).catch(() => {});
    await page.getByTestId("stage-split").waitFor({ state: "detached", timeout: 12_000 }).catch(() => {});
    await page.waitForTimeout(1200);
    // 0. the hero: the stage itself — the place, the first answer, the photo with its threads
    await page.screenshot({ path: path.join(out, `hero-${lang}.jpg`), type: "jpeg", quality: 82, clip: { x: 30, y: 125, width: 1230, height: 860 } });
    // 1. read & understand: the lantern opened (meaning, kanji parts)
    const obj = page.locator('[data-object="lantern"]').first();
    const box = await obj.boundingBox();
    if (box) {
      await obj.click({ position: { x: box.width * 0.85, y: box.height * 0.75 } });
      await page.waitForTimeout(900);
      const card = page.locator('[data-testid="guide-card"]').first();
      await card.screenshot({ path: path.join(out, `read-${lang}.jpg`), type: "jpeg", quality: 82 });
    } else fails.push(`${lang}: no lantern`);
    // 2. across time: the stage at the broken thread's year (the photo falls to night, the cord cut)
    await page.keyboard.press("Escape");
    const handle = page.getByTestId("time-handle");
    await handle.focus();
    for (let i = 0; i < 14; i++) await page.keyboard.press("Shift+ArrowUp");
    for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(1400);
    await page.getByTestId("stage-photo").screenshot({ path: path.join(out, `time-${lang}.jpg`), type: "jpeg", quality: 82 });
    for (let i = 0; i < 15; i++) await page.keyboard.press("Shift+ArrowDown");
    await page.waitForTimeout(800);
    // (the time panel, for the record)
    await page.getByTestId("time-toggle").click();
    const panel = page.getByTestId("time-panel");
    await panel.getByTestId("time-turn").waitFor();
    await panel.getByRole("slider").fill("1878");
    await page.waitForTimeout(1400);
    await panel.getByTestId("time-turn").screenshot({ path: path.join(out, `time-panel-${lang}.jpg`), type: "jpeg", quality: 82 });
    // 3. take it home: the postcard
    const r = await ctx.request.get(`${base}/api/explorations/${id}/postcard?lang=${lang}`);
    if (r.ok()) writeFileSync(path.join(out, `postcard-${lang}.png`), await r.body());
    else fails.push(`${lang}: postcard ${r.status()}`);
    await ctx.close();
  }
  console.log(JSON.stringify({ out, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
