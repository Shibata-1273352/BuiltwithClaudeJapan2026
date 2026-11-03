/**
 * Every main screen at 3840×2160 (a 4K display at 100%), no Claude: the landing, /how, the replay
 * stage (and presenter mode), the time panel, the names, 間 inside the print, the notes.
 * Reports horizontal overflow and how much of the screen the content uses.
 *   npx tsx --env-file=.env scripts/shots-4k.ts <baseUrl> <replay id> <scene id> [--w 3840 --h 2160]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const [base, replay, scene, ...rest] = process.argv.slice(2);
if (!base || !replay || !scene) throw new Error("usage: shots-4k.ts <baseUrl> <replay id> <scene id>");
const W = rest.includes("--w") ? Number(rest[rest.indexOf("--w") + 1]) : 3840;
const H = rest.includes("--h") ? Number(rest[rest.indexOf("--h") + 1]) : 2160;
const out = path.join(process.env.DATA_DIR!, "out", "screens", `w${W}`);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const u = new URL(base);
await ctx.addCookies([
  { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
  { name: "tsumugi_lang", value: "ja", domain: u.hostname, path: "/" },
  { name: "tsumugi_presenter", value: process.env.PRESENTER_TOKEN!, domain: u.hostname, path: "/" },
]);
const page = await ctx.newPage();
const report: Record<string, unknown> = {};
async function measure(name: string, p: Page) {
  const m = await p.evaluate(() => {
    const doc = document.documentElement;
    let minX = Infinity, maxX = 0;
    for (const el of Array.from(document.querySelectorAll("main *, body > div *")).slice(0, 4000)) {
      const r = (el as HTMLElement).getBoundingClientRect();
      if (r.width < 4 || r.height < 4 || r.width > innerWidth * 0.98) continue;
      minX = Math.min(minX, r.left);
      maxX = Math.max(maxX, r.right);
    }
    return { overflowX: doc.scrollWidth > innerWidth + 1, pageH: doc.scrollHeight, rootPx: parseFloat(getComputedStyle(doc).fontSize), usedW: Math.round(((maxX - minX) / innerWidth) * 100) };
  });
  report[name] = m;
  await p.screenshot({ path: path.join(out, `${name}.png`) });
}
const go = async (url: string, wait = 2500) => {
  await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(wait);
};
await go("/");
await measure("landing", page);
await go("/how");
await measure("how", page);
await go(`/replay/${replay}`);
await page.getByTestId("note-link").waitFor({ timeout: 90_000 });
await page.waitForTimeout(1500);
await measure("stage", page);
const timeBtn = page.getByTestId("time-toggle");
if (await timeBtn.count()) {
  await timeBtn.first().click();
  await page.waitForTimeout(2500);
  await measure("time", page);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
}
const namesBtn = page.getByTestId("names-toggle");
if (await namesBtn.count()) {
  await namesBtn.first().click();
  await page.waitForTimeout(2500);
  await measure("names", page);
  await page.keyboard.press("Escape");
}
await go(`/replay/${replay}?present=1`);
await page.getByTestId("note-link").waitFor({ timeout: 90_000 });
await page.waitForTimeout(1500);
await measure("stage-present", page);
await go(`/space/${scene}?enter=1`, 9000);
await measure("space-inside", page);
await go("/notes");
await measure("notes", page);
console.log(JSON.stringify({ out, report }, null, 1));
await browser.close();
