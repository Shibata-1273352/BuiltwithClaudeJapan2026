/**
 * The video, beat by beat, as stills (docs/demo-script.md): the frames a viewer would see, in presenter
 * mode, from the public recording (no Claude call). Output: $DATA_DIR/out/screens/storyboard/<lang>/
 *   npx tsx --env-file=.env scripts/storyboard.ts <baseUrl> <replay id> <scene id> [--lang en] [--w 1920 --h 1080]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, replay, scene, ...rest] = process.argv.slice(2);
if (!base || !replay || !scene) throw new Error("usage: storyboard.ts <baseUrl> <replay id> <scene id> [--lang en]");
const opt = (k: string, d: string) => (rest.includes(k) ? rest[rest.indexOf(k) + 1] : d);
const lang = opt("--lang", "ja");
const W = Number(opt("--w", "1920"));
const H = Number(opt("--h", "1080"));
const out = path.join(process.env.DATA_DIR!, "out", "screens", "storyboard", lang);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const u = new URL(base);
await ctx.addCookies([
  { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
  { name: "tsumugi_lang", value: lang, domain: u.hostname, path: "/" },
  { name: "tsumugi_presenter", value: process.env.PRESENTER_TOKEN!, domain: u.hostname, path: "/" },
]);
const page = await ctx.newPage();
const fails: string[] = [];
const shot = (n: string) => page.screenshot({ path: path.join(out, `${n}.png`) });
const vis = (id: string) => page.getByTestId(id).filter({ visible: true }).first();

// 1. the question: the landing
await page.goto(`${base}/`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await shot("1-landing");
// 2. the first answer (the recording, held discovery, half speed)
await page.goto(`${base}/replay/${replay}?present=1&hold=broken&speed=0.5`, { waitUntil: "domcontentloaded" });
for (const s of [4, 8, 14, 20]) {
  await page.waitForTimeout(s === 4 ? 4000 : s === 8 ? 4000 : 6000);
  await shot(`2-answer-${s}s`);
}
await vis("note-link").waitFor({ timeout: 90_000 });
await page.waitForTimeout(1500);
await shot("2-answer-done");
if ((await vis("broken-callout").count()) > 0) fails.push("hold=broken: the 1878 discovery showed before the years were turned");
// 3. 1878: turn the years on the stage
const handle = vis("time-handle");
await handle.focus();
for (let i = 0; i < 14; i++) await page.keyboard.press("Shift+ArrowUp");
for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowUp");
await page.waitForTimeout(2200);
await shot("3-1878");
if ((await vis("broken-callout").count()) === 0) fails.push("1878: the discovery did not show after turning the years");
// 4. the time panel: 1866, then let it flow to the rebuild
await vis("time-toggle").click();
const panel = page.getByTestId("time-panel");
await panel.getByRole("slider").fill("1866");
await page.waitForTimeout(1200);
await shot("4-1866");
await panel.getByRole("slider").fill("1961");
await page.waitForTimeout(1500);
await shot("4-1961");
if ((await panel.getByTestId("time-knot").count()) === 0) fails.push("1961: the Japanese and English records do not tie a knot");
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
// 6a (proof). one check in 舞台裏: a claim code held back, and why
await vis("backstage-toggle").click();
await page.waitForTimeout(1200);
await shot("6a-check");
if ((await page.getByTestId("one-check").count()) === 0) fails.push("backstage: no one-check example");
await page.keyboard.press("Escape");
// 5. into the print
await page.goto(`${base}/space/${scene}?enter=1&present=1`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
await shot("5-arrive");
await page.waitForTimeout(5000);
await shot("5-inside");
// 6a. how it works
await page.goto(`${base}/how`, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await shot("6a-how");
// 6b. the close: the postcard (built from the cached story, no Claude)
await page.goto(`${base}/api/explorations/${replay}/postcard?lang=${lang}`, { waitUntil: "load" });
await page.waitForTimeout(800);
await shot("6b-close");
console.log(JSON.stringify({ out, fails }, null, 1));
await browser.close();
process.exit(fails.length ? 1 : 0);
