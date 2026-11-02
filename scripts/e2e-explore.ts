/**
 * E2E: photo → on-device preprocessing → upload → exploration → SSE until done (headless Chromium).
 *   npx tsx --env-file=.env scripts/e2e-explore.ts <baseUrl> <image.jpg>
 * Makes one real Claude call (~$0.05). Saves a screenshot to $DATA_DIR/out/explore/.
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, image] = process.argv.slice(2);
if (!base || !image) throw new Error("usage: e2e-explore.ts <baseUrl> <image>");
const outDir = path.join(process.env.DATA_DIR!, "out", "explore");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1000, height: 2400 }, ignoreHTTPSErrors: true });
const u = new URL(base);
const page = await ctx.newPage();
const errors: string[] = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && !m.text().startsWith("INFO:") && errors.push(m.text()));

// First visit with the token (cookie is set by the proxy). Over plain http the Secure cookie
// would be dropped, so for local http runs we set the cookies directly instead.
if (u.protocol === "https:") {
  await page.goto(`${base}/?token=${encodeURIComponent(process.env.ACCESS_TOKEN!)}`, { waitUntil: "networkidle" });
} else {
  await ctx.addCookies([
    { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
    { name: "tsumugi_sid", value: crypto.randomUUID(), domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
  ]);
  await page.goto(base + "/", { waitUntil: "networkidle" });
}

const t0 = Date.now();
await page.getByTestId("file-input").setInputFiles(image);
await page.getByTestId("faces").waitFor({ timeout: 60_000 });
await page.getByTestId("send").click();
const status = page.getByTestId("exploration-status");
await page.waitForFunction(
  () => /完了|失敗|できません/.test(document.querySelector('[data-testid="exploration-status"]')?.textContent ?? ""),
  null,
  { timeout: 120_000 },
);
const ms = Date.now() - t0;
await page.screenshot({ path: path.join(outDir, "explore.png"), fullPage: true });
const text = (await page.getByTestId("exploration").textContent()) ?? "";
console.log(
  JSON.stringify(
    {
      ms,
      status: await status.textContent(),
      place: await page.getByTestId("place").textContent().catch(() => null),
      excerpt: text.slice(0, 300),
      existence: await page.getByTestId("existence").innerText().catch(() => null),
      claims: await page.getByTestId("claims").innerText().catch(() => null),
      threads: await page.getByTestId("threads").innerText().catch(() => null),
      errors,
    },
    null,
    2,
  ),
);
await browser.close();
