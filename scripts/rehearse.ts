/**
 * Rehearsal of the demo script (REQUIREMENTS 6.5) on the stage, in presenter mode at 1920×1080:
 * times each beat of a run, then walks the later scenes (時をめくる 1856→1878→1960, 言の地層, 舞台裏)
 * with a screenshot of each. Default: the public recording (no Claude call).
 *   npx tsx --env-file=.env scripts/rehearse.ts http://127.0.0.1:3100 [/replay/<id> | /live]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const [base, routeArg] = process.argv.slice(2);
if (!base) throw new Error("usage: rehearse.ts <baseUrl> [/replay/<id> | /live]");
const route = routeArg ?? `/replay/${process.env.DEMO_REPLAY_ID}`;
const outDir = path.join(process.env.DATA_DIR!, "out", "screens", "rehearsal");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const fails: string[] = [];
const at: Record<string, number> = {};
const shot = (page: Page, name: string) => page.screenshot({ path: path.join(outDir, `${name}.png`) });
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const u = new URL(base);
  await ctx.addCookies([{ name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const t0 = Date.now();
  await page.goto(`${base}${route}${route.includes("?") ? "&" : "?"}present=1`, { waitUntil: "domcontentloaded" });
  const beats = ["place-title", "stage-split", "viewpoint", "rope-layer", "broken-callout", "narrative", "note-link"];
  while (Date.now() - t0 < 120_000 && !("note-link" in at)) {
    for (const b of beats) if (!(b in at) && (await page.getByTestId(b).count()) > 0) at[b] = Math.round((Date.now() - t0) / 100) / 10;
    if (at["stage-split"] && !at.overlayShot) {
      await shot(page, "1-overlay");
      at.overlayShot = 1;
    }
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(2500);
  await shot(page, "2-done");

  // 1:15 時をめくる: 1856 → 1878 (the gate is gone, the thread breaks) → 1960 (it returns)
  await page.getByTestId("time-toggle").click();
  const slider = page.getByTestId("time-panel").getByRole("slider");
  for (const y of [1856, 1878, 1960]) {
    await slider.fill(String(y));
    await page.waitForTimeout(700);
    await shot(page, `3-time-${y}`);
  }
  await page.getByTestId("time-panel").getByRole("button", { name: "閉じる" }).click();
  // 言の地層 is not in the six-beat video (docs/demo-script.md): presenter mode hides its button
  if (await page.getByTestId("names-toggle").isVisible()) fails.push("presenter mode shows the names button (not in the video)");
  // 2:15 / 2:40 舞台裏 + evaluation
  await page.getByTestId("backstage-toggle").click();
  await page.waitForTimeout(1200);
  await shot(page, "5-backstage");
  if ((await page.getByTestId("eval-numbers").count()) === 0) fails.push("no eval numbers");
  for (const b of beats) if (!(b in at)) fails.push(`never shown: ${b}`);
  if (errors.length) fails.push(...errors.slice(0, 3));
  console.log(JSON.stringify({ route, secondsFromOpen: at, outDir, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
