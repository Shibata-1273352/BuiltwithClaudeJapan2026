/**
 * The demo flow, clicked as on camera (no live runs, $0):
 *   1878 by one click on a card's year → into the print → step out → back to the stage, still at 1878
 *   (the reveal kept, no beats replayed) → the postcard shows in the app → home from the print.
 *   npx tsx --env-file=.env scripts/flow-check.ts <baseUrl> <replay id>
 */
import { chromium } from "playwright";

const [base, replay] = process.argv.slice(2);
if (!base || !replay) throw new Error("usage: flow-check.ts <baseUrl> <replay id>");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const u = new URL(base);
await ctx.addCookies([
  { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
  { name: "tsumugi_lang", value: "ja", domain: u.hostname, path: "/" },
]);
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
const fails: string[] = [];
const log: string[] = [];
const out = "/Users/shibata/tsumugi-data/out/screens/flow";
const v = (id: string) => page.getByTestId(id).filter({ visible: true }).first();

await page.goto(`${base}/replay/${replay}?present=1&hold=broken&at=end`, { waitUntil: "domcontentloaded" });
await v("note-link").waitFor({ timeout: 60_000 });
if ((await page.evaluate(() => document.documentElement.dataset.present)) !== "1") fails.push("presenter mode is not on");

// 1878 in one click
const year = page.getByTestId("card-year").filter({ visible: true, hasText: "1878" }).first();
if (!(await year.count())) fails.push("no clickable 1878 on a card");
else {
  await year.click();
  await v("broken-callout").waitFor({ timeout: 5000 }).catch(() => fails.push("1878: the callout did not appear"));
  await page.screenshot({ path: `${out}/1-1878.png` });
}
if (!/[?&]y=1878/.test(page.url())) fails.push(`the address does not keep the year (${page.url()})`);

// into the print and back
await v("space-link").click();
await page.waitForURL(/\/space\//);
if ((await page.evaluate(() => document.documentElement.dataset.present)) !== "1") fails.push("presenter mode was lost in the print");
await page.waitForTimeout(4000);
await page.screenshot({ path: `${out}/2-inside.png` });
if (!(await v("home-link").count())) fails.push("no way home inside the print");
const t0 = Date.now();
await v("back-link").click();
await v("note-link").waitFor({ timeout: 15_000 }).catch(() => fails.push("the stage did not come back"));
log.push(`back to the stage in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
await v("broken-callout").waitFor({ timeout: 4000 }).catch(() => fails.push("back from the print: the 1878 reveal was lost"));
await page.screenshot({ path: `${out}/3-back.png` });

// the postcard lands in the app
await v("postcard-link").click();
await v("postcard-view").waitFor({ timeout: 20_000 }).catch(() => fails.push("the postcard is not shown in the app"));
await page.screenshot({ path: `${out}/4-postcard.png` });
await v("postcard-close").click().catch(() => {});

// home from the print
await v("space-link").click();
await page.waitForURL(/\/space\//);
await v("home-link").click();
await page.waitForURL((x) => x.pathname === "/", { timeout: 10_000 }).catch(() => fails.push("home link did not reach the start"));

// the presenter's takes
await page.goto(`${base}/present`, { waitUntil: "domcontentloaded" });
if (!(await page.getByTestId("takes").count())) fails.push("/present has no takes list");

for (const e of errors) fails.push(`page error: ${e.slice(0, 160)}`);
console.log(JSON.stringify({ out, log, fails }, null, 1));
await browser.close();
