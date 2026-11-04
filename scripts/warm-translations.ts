/**
 * Make the reference translations of a run once, before recording (one Claude call per language,
 * cached; the stage and the note then read the cache). Prints the cost of the call.
 *   npx tsx --env-file=.env scripts/warm-translations.ts <baseUrl> <exploration id> [ja en]
 */
import Database from "better-sqlite3";
import path from "node:path";

const [base, id, ...langs] = process.argv.slice(2);
if (!base || !id) throw new Error("usage: warm-translations.ts <baseUrl> <exploration id> [ja en]");
const db = new Database(path.join(process.env.DATA_DIR!, "tsumugi.db"), { readonly: true });
const before = (db.prepare("SELECT COALESCE(SUM(cost_usd),0) c FROM ai_calls WHERE stage LIKE 'translate:%'").get() as { c: number }).c;
for (const lang of langs.length ? langs : ["ja", "en"]) {
  const r = await fetch(`${base}/api/explorations/${id}/translations?lang=${lang}`, { headers: { cookie: `tsumugi_token=${process.env.ACCESS_TOKEN}` } });
  const j = (await r.json()) as { items?: Record<string, string>; cached?: boolean; error?: string };
  console.log(lang, r.status, j.cached ? "cached" : "made", Object.keys(j.items ?? {}).length, "items", j.error ?? "");
}
const after = (db.prepare("SELECT COALESCE(SUM(cost_usd),0) c FROM ai_calls WHERE stage LIKE 'translate:%'").get() as { c: number }).c;
console.log(`cost of this warm-up: $${(after - before).toFixed(4)}`);
