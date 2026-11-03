/**
 * The same frames every time, for before/after design comparison (no Claude call: the public
 * recording). Output: $DATA_DIR/out/screens/design/<label>/*.png
 *   npx tsx --env-file=.env scripts/design-shots.ts http://127.0.0.1:3100 <label>
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import { chromium, type BrowserContext } from "playwright";
import Database from "better-sqlite3";

const [base, label = "now"] = process.argv.slice(2);
if (!base) throw new Error("usage: design-shots.ts <baseUrl> <label>");
const id = process.env.DEMO_REPLAY_ID!;
const db = new Database(path.join(process.env.DATA_DIR!, "tsumugi.db"), { readonly: true });
const cap = (db.prepare("SELECT capture_id FROM explorations WHERE id = ?").get(id) as { capture_id: string }).capture_id;
const out = path.join(process.env.DATA_DIR!, "out", "screens", "design", label);
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const errors: string[] = [];
async function ctxFor(w: number, h: number): Promise<BrowserContext> {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: w < 500, hasTouch: w < 500 });
  await ctx.addCookies([{ name: "tsumugi_token", value: process.env.ACCESS_TOKEN!, domain: new URL(base).hostname, path: "/", httpOnly: true, sameSite: "Strict" }]);
  return ctx;
}
async function timed(ctx: BrowserContext, route: string, name: string, times: number[], full = false) {
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${route}: ${e}`));
  const t0 = Date.now();
  await page.goto(base + route, { waitUntil: "domcontentloaded" });
  for (const t of times) {
    const wait = t * 1000 - (Date.now() - t0);
    if (wait > 0) await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(out, `${name}-${t}s.png`), fullPage: full });
  }
  await page.close();
}
try {
  const wide = await ctxFor(1920, 1080);
  await timed(wide, "/", "landing", [2], true);
  await timed(wide, `/replay/${id}`, "stage", [3, 12, 20, 30]);
  await timed(wide, `/replay/${id}?present=1`, "present", [30]);
  await timed(wide, `/note/${id}`, "note", [3], true);
  await timed(wide, `/space/${cap}?enter=1`, "space", [8]);
  await timed(wide, `/time?entity=ent:kaminarimon`, "time", [3]);
  const phone = await ctxFor(390, 844);
  await timed(phone, "/", "phone-landing", [2]);
  await timed(phone, `/replay/${id}`, "phone-stage", [30], true);
  console.log(JSON.stringify({ out, errors: errors.slice(0, 6) }));
} finally {
  await browser.close();
}
