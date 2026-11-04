/**
 * Into the print and out again, as a visitor clicks it (no presenter mode, no live run, $0):
 * the stage → 「絵の中へ」 → frames over time (what is on screen, what can be used) → 「絵から出る」.
 *   npx tsx --env-file=.env scripts/print-check.ts <baseUrl> <replay id> [--present]
 */
import { chromium } from "playwright";

const [base, replay, ...rest] = process.argv.slice(2);
if (!base || !replay) throw new Error("usage: print-check.ts <baseUrl> <replay id> [--present]");
const present = rest.includes("--present");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const u = new URL(base);
await ctx.addCookies([
  { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
  { name: "tsumugi_lang", value: "ja", domain: u.hostname, path: "/" },
]);
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
const out = `${process.env.DATA_DIR}/out/screens/print${present ? "-present" : ""}`;
const log: string[] = [];
const fails: string[] = [];
const v = (id: string) => page.getByTestId(id).filter({ visible: true });

await page.goto(`${base}/replay/${replay}?at=end${present ? "&present=1" : ""}`, { waitUntil: "domcontentloaded" });
await v("space-link").first().waitFor({ timeout: 60_000 });
log.push(`space link: ${await v("space-link").first().getAttribute("href")}`);
await v("space-link").first().click();
await page.waitForURL(/\/space\//);
const t0 = Date.now();
for (const at of [300, 1200, 2500, 4500, 7000]) {
  await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
  // (no named helpers inside evaluate: tsx would inject __name, which the page does not have)
  const state = await page.evaluate(() => {
    const shown = [...document.querySelectorAll<HTMLElement>("[data-testid]")].filter((e) => e.offsetParent !== null).map((e) => e.dataset.testid);
    const sliders = [...document.querySelectorAll<HTMLInputElement>('input[type="range"]')].filter((e) => e.offsetParent !== null).map((e) => e.dataset.testid ?? e.ariaLabel ?? "range");
    const btn = [...document.querySelectorAll<HTMLButtonElement>('[data-testid="enter-painting"]')].find((e) => e.offsetParent !== null);
    return { url: location.pathname + location.search, sliders, enter: btn ? `${btn.textContent?.trim()}${btn.disabled ? " (disabled)" : ""}` : null, flat: shown.includes("space-2d"), back: shown.filter((x) => x === "back-link").length, home: shown.filter((x) => x === "home-link").length };
  });
  log.push(`${at} ms: ${JSON.stringify(state)}`);
  await page.screenshot({ path: `${out}/t${at}.png` });
}
// step out
const exit = v("enter-painting").first();
if (!(await exit.count())) fails.push("inside the print: no 「絵から出る」 button on screen");
else {
  const label = (await exit.textContent())?.trim();
  // can it actually be clicked (nothing on top of it)?
  const free = await exit.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return top === el || el.contains(top);
  });
  log.push(`exit button "${label}", clickable: ${free}`);
  if (!free) fails.push("the exit button is covered by something");
  await exit.click({ timeout: 5000 }).catch((e) => fails.push(`exit click failed: ${String(e).slice(0, 120)}`));
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => ({ url: location.pathname + location.search, enter: document.querySelector('[data-testid="enter-painting"]')?.textContent?.trim() ?? null }));
  log.push(`after exit: ${JSON.stringify(after)}`);
  await page.screenshot({ path: `${out}/after-exit.png` });
  // stepping out of the print returns to the stage it was entered from
  if (after.url.startsWith("/space/")) fails.push(`after 「絵から出る」 still on the print page (${after.url})`);
}
// no control on screen that cannot act: while entering, no layer sliders
const entering = log.filter((x) => /^(300|1200|2500) ms/.test(x));
if (entering.some((x) => /"sliders":\["/.test(x))) fails.push("layer sliders are shown while the camera enters (they cannot act)");
if (entering.some((x) => /"back":0/.test(x))) fails.push("a moment with no way back on screen while entering");
for (const e of errors) fails.push(`page error: ${e}`);
console.log(JSON.stringify({ out, log, fails }, null, 1));
await browser.close();
