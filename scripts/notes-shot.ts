/**
 * The trip weave and the postcard button, by screenshot (presenter view of the latest notes; no Claude).
 *   npx tsx --env-file=.env scripts/notes-shot.ts http://127.0.0.1:3100
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const base = process.argv[2];
if (!base) throw new Error("usage: notes-shot.ts <baseUrl>");
const out = path.join(process.env.DATA_DIR!, "out", "screens", "notes");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const fails: string[] = [];
try {
  for (const lang of ["ja", "en"]) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1100 } });
    const u = new URL(base);
    await ctx.addCookies([
      { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
      { name: "tsumugi_presenter", value: process.env.PRESENTER_TOKEN!, domain: u.hostname, path: "/" },
      { name: "tsumugi_lang", value: lang, domain: u.hostname, path: "/" },
    ]);
    const page = await ctx.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(`${base}/notes`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(out, `${lang}-notes.png`), fullPage: true });
    if (!(await page.getByTestId("trip-weave").count())) fails.push(`${lang}: no trip weave`);
    else await page.getByTestId("trip-weave").screenshot({ path: path.join(out, `${lang}-weave.png`) });
    const first = page.locator('[data-testid="notes-list"] a').first();
    if (await first.count()) {
      await first.click();
      await page.getByTestId("travel-note").waitFor({ state: "attached", timeout: 30_000 });
      await page.waitForTimeout(1500);
      if (!(await page.getByTestId("postcard-link").count())) fails.push(`${lang}: no postcard button on the note`);
      await page.screenshot({ path: path.join(out, `${lang}-note.png`) });
    }
    if (errors.length) fails.push(...errors.slice(0, 2));
    await ctx.close();
  }
  console.log(JSON.stringify({ out, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
