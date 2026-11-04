/**
 * Recording-day go / no-go (no Claude call): the server, the public recording, the caps' headroom,
 * the cached translations and stories, and every page the video opens.
 *   npx tsx --env-file=.env scripts/preflight.ts <baseUrl> [scene id]
 */
import Database from "better-sqlite3";
import path from "node:path";

const [base, sceneArg] = process.argv.slice(2);
if (!base) throw new Error("usage: preflight.ts <baseUrl> [scene id]");
const id = process.env.DEMO_REPLAY_ID;
const db = new Database(path.join(process.env.DATA_DIR!, "tsumugi.db"), { readonly: true });
const rows: { check: string; ok: boolean; detail: string }[] = [];
const add = (check: string, ok: boolean, detail: string) => rows.push({ check, ok, detail });

add("DEMO_REPLAY_ID set", Boolean(id), id ?? "missing in .env");
const run = id ? (db.prepare("SELECT status, capture_id, cost_usd FROM explorations WHERE id = ?").get(id) as { status: string; capture_id: string; cost_usd: number } | undefined) : undefined;
add("the recording is done", run?.status === "done", run ? `${run.status}, recorded run cost $${run.cost_usd?.toFixed(2)}` : "not found");
const scene = sceneArg ?? run?.capture_id;

const kill = db.prepare("SELECT value FROM settings WHERE key = 'kill'").get() as { value: string } | undefined;
add("kill switch off", kill?.value !== "1", kill?.value === "1" ? "ON — no live run or question will work" : "off");
const now = new Date();
const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
const perHour = Number(process.env.EXPLORATIONS_PER_HOUR ?? 30);
const n = (db.prepare("SELECT count(*) n FROM explorations WHERE created_at > ?").get(hourAgo) as { n: number }).n;
add("explorations this hour", n < perHour - 2, `${n} of ${perHour}`);
const day = now.toISOString().slice(0, 10);
const cap = Number(process.env.DAILY_COST_LIMIT_USD ?? 20);
const spent = (db.prepare("SELECT coalesce(sum(cost_usd),0) c FROM ai_calls WHERE ts >= ?").get(`${day}T00:00:00`) as { c: number }).c;
add("Claude spend today (UTC day)", spent < cap - 2, `$${spent.toFixed(2)} of $${cap}`);
if (id) {
  const asks = (db.prepare("SELECT count(*) n FROM ai_calls WHERE exploration_id = ? AND stage = 'ask' AND ts > ?").get(id, hourAgo) as { n: number }).n;
  add("questions on the recording this hour", asks <= 6, `${asks} of 10 (each take with two questions uses 2)`);
  for (const lang of ["ja", "en"]) {
    const t = db.prepare("SELECT json FROM translations WHERE exploration_id = ? AND lang = ?").get(id, lang) as { json: string } | undefined;
    add(`reference translations cached (${lang})`, Boolean(t), t ? `${Object.keys(JSON.parse(t.json)).length} items` : "missing — run scripts/warm-translations.ts");
  }
}

const cookie = `tsumugi_token=${process.env.ACCESS_TOKEN}`;
const pages = ["/", "/how", "/time", ...(id ? [`/replay/${id}?present=1&hold=broken`] : []), ...(scene ? [`/space/${scene}?enter=1&3d=1`] : [])];
for (const p of pages) {
  try {
    const r = await fetch(`${base}${p}`, { headers: { cookie } });
    add(`page ${p}`, r.ok, String(r.status));
  } catch (e) {
    add(`page ${p}`, false, `unreachable (${(e as Error).message})`);
  }
}
const dev = await fetch(`${base}/`, { headers: { cookie } }).then((r) => r.text()).catch(() => "");
add("production build (not next dev)", !/__nextjs_original-stack-frame|next-dev-overlay|webpack-hmr|turbopack-hmr/.test(dev), "npm run build && npm start");

for (const r of rows) console.log(`${r.ok ? "GO   " : "NO-GO"}  ${r.check}: ${r.detail}`);
const go = rows.every((r) => r.ok);
console.log(go ? "\nGO — ready to record" : "\nNO-GO — fix the lines above");
process.exit(go ? 0 : 1);
