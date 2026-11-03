/**
 * 絵の中へ on the machine's GPU (Metal), as a visitor reaches it: from the replay stage's link, and
 * opened directly. Logs the renderer, the 2D/3D state over time, errors, and a frame each second.
 *   npx tsx --env-file=.env scripts/space-probe.ts <baseUrl> <replay id> [--headed]
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "playwright";

const [base, replay, ...rest] = process.argv.slice(2);
if (!base || !replay) throw new Error("usage: space-probe.ts <baseUrl> <replay id> [--headed]");
const out = path.join(process.env.DATA_DIR!, "out", "screens", "space-probe");
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ headless: !rest.includes("--headed"), args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const u = new URL(base);
await ctx.addCookies([
  { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
  { name: "tsumugi_lang", value: "ja", domain: u.hostname, path: "/" },
]);

async function watch(page: Page, tag: string) {
  const log: string[] = [];
  for (let i = 1; i <= 14; i++) {
    await page.waitForTimeout(1000);
    const st = await page.evaluate(() => {
      const c = document.querySelector("canvas");
      const r = c?.getBoundingClientRect();
      return {
        url: location.pathname + location.search,
        canvas: c ? `${Math.round(r!.width)}x${Math.round(r!.height)} buf ${c.width}x${c.height}` : "none",
        twoD: !!document.querySelector('[data-testid="space-2d"]'),
        try3d: !!document.querySelector('[data-testid="space-try-3d"]'),
      };
    });
    log.push(`${tag} t=${i}s ${JSON.stringify(st)}`);
    if (i === 9) await page.mouse.move(200, 300, { steps: 12 });
    if (i === 11) await page.mouse.move(1400, 900, { steps: 12 });
    if ([2, 3, 4, 6, 9, 10, 12, 14].includes(i)) await page.screenshot({ path: path.join(out, `${tag}-${i}s.png`) });
  }
  return log;
}

const errors: string[] = [];
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror ${e}`));
page.on("console", (m) => (m.type() === "error" || m.type() === "warning") && errors.push(`${m.type()} ${m.text().slice(0, 300)}`));
const gl = await page.evaluate(() => {
  const c = document.createElement("canvas").getContext("webgl2");
  const ext = c?.getExtension("WEBGL_debug_renderer_info");
  return ext ? c!.getParameter(ext.UNMASKED_RENDERER_WEBGL) : String(!!c);
});
console.log("renderer:", gl);

// 1) as a visitor: the replay stage, wait for done, click 絵の中へ
await page.goto(`${base}/replay/${replay}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.getByTestId("space-link").waitFor({ timeout: 90_000 });
await page.waitForTimeout(1500);
await page.getByTestId("space-link").click();
for (const l of await watch(page, "nav")) console.log(l);

// 2) opened directly
const href = new URL(page.url());
await page.goto(`${base}${href.pathname}${href.search}`, { waitUntil: "domcontentloaded" });
for (const l of await watch(page, "direct")) console.log(l);

console.log("errors:", JSON.stringify(errors.slice(0, 12), null, 1));
await browser.close();
