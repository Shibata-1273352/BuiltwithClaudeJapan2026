/**
 * 時をめくる by screenshot (no Claude, the public recording): open the panel after the run and turn
 * the river to 1856 / 1878 (mid-burn and after) / 1905 / 1960, then let the years flow.
 *   npx tsx --env-file=.env scripts/time-shot.ts http://127.0.0.1:3200 [replay id] [--lang en]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, idArg, ...rest] = process.argv.slice(2);
const id = idArg && !idArg.startsWith("--") ? idArg : process.env.DEMO_REPLAY_ID!;
const lang = [idArg, ...rest].includes("--lang") ? [idArg, ...rest][[idArg, ...rest].indexOf("--lang") + 1] : "ja";
const out = path.join(process.env.DATA_DIR!, "out", "screens", "time");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const fails: string[] = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const u = new URL(base);
  await ctx.addCookies([
    { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
    { name: "tsumugi_lang", value: lang, domain: u.hostname, path: "/" },
  ]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${base}/replay/${id}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("note-link").waitFor({ timeout: 120_000 });
  await page.getByTestId("time-toggle").click();
  const panel = page.getByTestId("time-panel");
  await panel.getByTestId("time-turn").waitFor();
  await page.waitForTimeout(600);
  const shot = (n: string) => panel.screenshot({ path: path.join(out, `${lang}-${n}.png`) });
  await shot("0-now");
  const slider = panel.getByRole("slider");
  const go = async (y: number, wait = 900) => {
    await slider.fill(String(y));
    await page.waitForTimeout(wait);
  };
  await go(1856);
  await shot("1-1856");
  await go(1866);
  await shot("1b-1866-conflict");
  if ((await panel.getByTestId("time-conflict").count()) === 0) fails.push("1866: the disagreeing sources are not shown");
  await go(1878, 320);
  await shot("2-1878-burning");
  await page.waitForTimeout(700);
  await shot("3-1878");
  if ((await panel.getByTestId("time-writer").count()) === 0) fails.push("1878: no writer");
  await go(1905);
  await shot("4-1905");
  await go(1960, 320);
  await shot("5-1960-rising");
  await page.waitForTimeout(700);
  await shot("6-1960");
  await panel.getByTestId("time-play").click();
  await page.waitForTimeout(5200);
  await shot("7-playing");
  if (errors.length) fails.push(...errors.slice(0, 3));
  console.log(JSON.stringify({ out, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
