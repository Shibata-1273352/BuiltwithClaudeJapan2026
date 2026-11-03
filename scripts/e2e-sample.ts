/**
 * "例で試す" end to end (LIVE — one real exploration, ~$0.2): the landing button → /live → the
 * stage fills beat by beat → done. Screenshots at fixed times, and the testids of every beat.
 *   npx tsx --env-file=.env scripts/e2e-sample.ts http://127.0.0.1:3100 [--phone]
 * Prints the exploration id (record it as DEMO_REPLAY_ID if the run is good).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const [base, ...rest] = process.argv.slice(2);
if (!base) throw new Error("usage: e2e-sample.ts <baseUrl> [--phone]");
const token = process.env.ACCESS_TOKEN!;
const phone = rest.includes("--phone");
const outDir = path.join(process.env.DATA_DIR!, "out", "screens");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const fails: string[] = [];
const seen: Record<string, number> = {};
try {
  const ctx = await browser.newContext({ viewport: phone ? { width: 390, height: 844 } : { width: 1920, height: 1080 } });
  const u = new URL(base);
  await ctx.addCookies([{ name: "tsumugi_token", value: token, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  let expId = "";
  page.on("response", async (r) => {
    if (r.url().endsWith("/api/explorations/sample") && r.status() === 202) expId = (await r.json()).exploration_id;
  });
  await page.goto(base + "/", { waitUntil: "networkidle" });
  const t0 = Date.now();
  await page.getByTestId("try-sample").click();
  const beats = ["stage-photo", "step-rail", "see-ask", "place-title", "search-matrix", "evidence-card", "claude-line", "viewpoint", "thread-layer", "broken-callout", "narrative", "associations", "note-link"];
  const shots = [3, 12, 20, 30, 45];
  let shot = 0;
  while (Date.now() - t0 < 110_000) {
    for (const b of beats) if (!(b in seen) && (await page.getByTestId(b).count()) > 0) seen[b] = Math.round((Date.now() - t0) / 100) / 10;
    const t = (Date.now() - t0) / 1000;
    if (shot < shots.length && t >= shots[shot]) {
      await page.screenshot({ path: path.join(outDir, `sample-${phone ? 390 : 1920}-${shots[shot]}s.png`) });
      shot++;
    }
    if ("note-link" in seen && shot >= shots.length) break;
    // (Next.js has its own route announcer with role=alert; only the stage's alerts count)
    if ((await page.locator("main [role=alert]").count()) > 0) {
      fails.push(`alert: ${await page.locator("main [role=alert]").first().innerText()}`);
      break;
    }
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, `sample-${phone ? 390 : 1920}-end.png`) });
  for (const b of beats) if (!(b in seen) && !(phone && b === "thread-layer")) fails.push(`never shown: ${b}`);
  if (errors.length) fails.push(...errors.slice(0, 3));
  console.log(JSON.stringify({ expId, seenAtSeconds: seen, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
