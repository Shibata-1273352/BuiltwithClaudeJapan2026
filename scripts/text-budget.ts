/**
 * How much text each screen shows (visible characters in the viewport, no Claude call), so "less text"
 * is measured, not guessed. Prints one line per screen; writes $DATA_DIR/out/text-budget-<lang>.json.
 *   npx tsx --env-file=.env scripts/text-budget.ts <baseUrl> <replay id> <scene id> [--lang en]
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const [base, replay, scene, ...rest] = process.argv.slice(2);
if (!base || !replay || !scene) throw new Error("usage: text-budget.ts <baseUrl> <replay id> <scene id> [--lang en]");
const lang = rest.includes("--lang") ? rest[rest.indexOf("--lang") + 1] : "ja";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const u = new URL(base);
await ctx.addCookies([
  { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
  { name: "tsumugi_lang", value: lang, domain: u.hostname, path: "/" },
  { name: "tsumugi_presenter", value: process.env.PRESENTER_TOKEN!, domain: u.hostname, path: "/" },
]);
const page = await ctx.newPage();

/** visible characters inside the first screen (1920×1080), whitespace removed */
async function count(p: Page) {
  return p.evaluate(() => {
    let chars = 0;
    let blocks = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el) continue;
      const t = (n.textContent ?? "").replace(/\s+/g, "");
      if (!t) continue;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      if (cs.visibility === "hidden" || Number(cs.opacity) < 0.05 || el.closest("[aria-hidden=true]")) continue;
      chars += t.length;
      const block = el.closest("p, li, h1, h2, h3, figcaption, blockquote, button, a, dd, dt, label") ?? el;
      if (!seen.has(block)) {
        seen.add(block);
        blocks++;
      }
    }
    return { chars, blocks };
  });
}
const out: Record<string, { chars: number; blocks: number }> = {};
async function measure(name: string, url: string, wait = 2500, then?: () => Promise<void>) {
  await page.goto(`${base}${url}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.waitForTimeout(wait);
  if (then) await then();
  out[name] = await count(page);
  console.log(`${name.padEnd(18)} ${String(out[name].chars).padStart(5)} chars  ${String(out[name].blocks).padStart(3)} blocks`);
}
await measure("landing", "/");
await measure("stage (presenter)", `/replay/${replay}?present=1&at=end`, 4000);
await measure("stage", `/replay/${replay}?at=end`, 4000);
await measure("print (inside)", `/space/${scene}?enter=1&3d=1`, 9000);
await measure("how", "/how");
await measure("time", "/time");
writeFileSync(path.join(process.env.DATA_DIR!, "out", `text-budget-${lang}.json`), JSON.stringify({ at: new Date().toISOString(), out }, null, 1));
await browser.close();
