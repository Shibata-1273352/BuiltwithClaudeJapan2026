/**
 * The public recording (DEMO_REPLAY_ID) as a judge sees it: a fresh browser session (token only,
 * not the session that ran it) replays it on the stage and can open everything it links to.
 *   npx tsx --env-file=.env scripts/e2e-demo.ts http://127.0.0.1:3100 [explorationId]
 */
import { chromium } from "playwright";

const [base, idArg] = process.argv.slice(2);
const id = idArg ?? process.env.DEMO_REPLAY_ID;
if (!base || !id) throw new Error("usage: e2e-demo.ts <baseUrl> [explorationId] (or DEMO_REPLAY_ID)");
const token = process.env.ACCESS_TOKEN!;

const browser = await chromium.launch();
const fails: string[] = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const u = new URL(base);
  await ctx.addCookies([{ name: "tsumugi_token", value: token, domain: u.hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  // the cookie alone must not be enough to bypass the local check: send it as a remote client would
  await page.setExtraHTTPHeaders({ "x-forwarded-for": "203.0.113.7" });
  await page.goto(`${base}/replay/${id}`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("replay-banner").waitFor({ timeout: 15_000 });
  await page.getByTestId("note-link").waitFor({ timeout: 120_000 });
  for (const tid of ["stage-photo", "step-rail", "result-strip", "evidence-column", "narrative", "thread-layer"]) {
    if ((await page.getByTestId(tid).count()) === 0) fails.push(`missing ${tid}`);
  }
  const hrefs = [await page.getByTestId("note-link").getAttribute("href"), await page.getByTestId("space-link").getAttribute("href").catch(() => null)].filter(Boolean) as string[];
  for (const h of hrefs) {
    const r = await page.request.get(base + h);
    if (r.status() !== 200) fails.push(`${h} -> ${r.status()}`);
  }
  // a different exploration is still private to its session
  const other = await page.request.get(`${base}/replay/exp_ffffffffffffffffffff`);
  // (inside Suspense, notFound() streams the 404 page with status 200 — check the content)
  const body = await other.text();
  if (body.includes("これは記録の再生です") || !/could not be found|404/.test(body)) fails.push(`unknown replay was served (${other.status()})`);
  if (errors.length) fails.push(...errors.slice(0, 3));
  console.log(JSON.stringify({ id, hrefs, fails }, null, 1));
} finally {
  await browser.close();
}
process.exit(fails.length ? 1 : 0);
