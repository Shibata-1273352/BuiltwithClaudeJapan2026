/**
 * 言の地層 on the print, by screenshot (no Claude, the public recording): open the panel, touch
 * Bird's "Ni-ô" (it lands on the far gate, not on Kaminarimon), then follow the names.
 *   npx tsx --env-file=.env scripts/names-shot.ts http://127.0.0.1:3200 [replay id] [--lang en]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const args = process.argv.slice(2);
const base = args[0];
const id = args[1] && !args[1].startsWith("--") ? args[1] : process.env.DEMO_REPLAY_ID!;
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "ja";
const out = path.join(process.env.DATA_DIR!, "out", "screens", "names");
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
  await page.getByTestId("names-toggle").click();
  const panel = page.getByTestId("names-panel");
  await panel.getByTestId("names-loom").waitFor().catch(() => fails.push("no names loom"));
  await page.waitForTimeout(800);
  const shot = (n: string) => page.screenshot({ path: path.join(out, `${lang}-${n}.png`) });
  await shot("1-open");
  const nio = panel.getByTestId("names-chip").filter({ hasText: /Ni-ô|Nio/ }).first();
  if (await nio.count()) {
    await nio.hover();
    await page.waitForTimeout(800);
    await shot("2-nio");
  } else fails.push("no Ni-ô chip");
  const kami = panel.getByTestId("names-chip").filter({ hasText: "雷門" }).first();
  if (await kami.count()) {
    await kami.hover();
    await page.waitForTimeout(800);
    await shot("3-kaminarimon");
  }
  await panel.getByTestId("names-tour").click();
  await page.waitForTimeout(5200);
  await shot("4-tour");
  if (errors.length) fails.push(...errors.slice(0, 3));
  console.log(JSON.stringify({ out, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
