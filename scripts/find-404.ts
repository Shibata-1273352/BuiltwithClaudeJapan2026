/**
 * Which resources fail to load on a page (status >= 400), for the console-error checks.
 *   npx tsx --env-file=.env scripts/find-404.ts <baseUrl> <route>
 */
import { chromium } from "playwright";

const [base, route = "/"] = process.argv.slice(2);
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext();
  const u = new URL(base);
  await ctx.addCookies([{ name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
  const page = await ctx.newPage();
  const bad: string[] = [];
  page.on("response", (r) => r.status() >= 400 && bad.push(`${r.status()} ${r.url()}`));
  await page.goto(base + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  console.log(JSON.stringify(bad, null, 1));
} finally {
  await browser.close();
}
