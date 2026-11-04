/**
 * Going back works: from the stage to the print / the note / /how and back, the stage comes back as it
 * was (finished at once), and no new exploration is started.
 *   npx tsx --env-file=.env scripts/back-check.ts <baseUrl> <replay id> [--live]
 * --live also checks a live run (one Claude run, its cost printed).
 */
import Database from "better-sqlite3";
import path from "node:path";
import { chromium, type Page } from "playwright";

const [base, replay, ...rest] = process.argv.slice(2);
if (!base || !replay) throw new Error("usage: back-check.ts <baseUrl> <replay id> [--live]");
const db = new Database(path.join(process.env.DATA_DIR!, "tsumugi.db"), { readonly: true });
const runs = () => (db.prepare("SELECT COUNT(*) n FROM explorations").get() as { n: number }).n;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const u = new URL(base);
await ctx.addCookies([
  { name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" },
  { name: "tsumugi_lang", value: "ja", domain: u.hostname, path: "/" },
]);
const page = await ctx.newPage();
const fails: string[] = [];
const log: string[] = [];

async function roundTrip(p: Page, label: string, open: () => Promise<void>, back: () => Promise<void>) {
  const before = runs();
  await open();
  await p.waitForTimeout(2500);
  const t0 = Date.now();
  await back();
  await p.getByTestId("note-link").filter({ visible: true }).first().waitFor({ timeout: 15_000 }).catch(() => fails.push(`${label}: the finished stage did not come back`));
  const s = (Date.now() - t0) / 1000;
  log.push(`${label}: back in ${s.toFixed(1)} s at ${p.url().replace(base, "")}`);
  if (s > 6) fails.push(`${label}: took ${s.toFixed(1)} s to come back (replayed from the start?)`);
  if (runs() !== before) fails.push(`${label}: a new exploration was started`);
}

// 1) the recording
await page.goto(`${base}/replay/${replay}`, { waitUntil: "domcontentloaded" });
await page.getByTestId("note-link").waitFor({ timeout: 120_000 });
await page.waitForTimeout(1200);
await roundTrip(page, "replay → print → back link", () => page.getByTestId("space-link").filter({ visible: true }).click(), () => page.getByTestId("back-link").filter({ visible: true }).click());
await roundTrip(page, "replay → print → browser back", () => page.getByTestId("space-link").filter({ visible: true }).click(), () => page.goBack().then(() => {}));
await roundTrip(page, "replay → note → back link", () => page.getByTestId("note-link").filter({ visible: true }).click(), () => page.getByTestId("back-link").filter({ visible: true }).click());

// 2) a live run
if (rest.includes("--live")) {
  const n0 = runs();
  await page.goto(`${base}/live`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("note-link").waitFor({ timeout: 150_000 });
  if (runs() !== n0 + 1) fails.push("live: expected exactly one new exploration");
  if (!/\/live\?run=exp_/.test(page.url())) fails.push(`live: the address does not name the run (${page.url()})`);
  await roundTrip(page, "live → print → browser back", () => page.getByTestId("space-link").filter({ visible: true }).click(), () => page.goBack().then(() => {}));
  await roundTrip(page, "live → note → back link", () => page.getByTestId("note-link").filter({ visible: true }).click(), () => page.getByTestId("back-link").filter({ visible: true }).click());
  const id = new URL(page.url()).searchParams.get("run");
  const c = db.prepare("SELECT cost_usd FROM explorations WHERE id = ?").get(id) as { cost_usd: number } | undefined;
  log.push(`live run ${id}: $${c?.cost_usd?.toFixed(4)}`);
}
console.log(JSON.stringify({ log, fails }, null, 1));
await browser.close();
process.exit(fails.length ? 1 : 0);
