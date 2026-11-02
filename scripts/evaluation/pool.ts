/**
 * Annotation pool for the evaluation gold (10.1), built WITHOUT the retrieval under test:
 *  - every non-index passage containing a dictionary name of the target or its site (raw substring
 *    / whole-word scan over the canonical text), and
 *  - every passage the reviewed timeline cites as event or relation evidence.
 * A person (or Claude Code, marked as such) then keeps or drops each passage by reading it.
 *   npx tsx --env-file=.env scripts/evaluation/pool.ts ent:kaminarimon > pool.tsv
 */
import { normalizeForSearch } from "@tsumugi/core";
import { openDb } from "../../apps/web/src/lib/corpus/db";
import { entities } from "../../apps/web/src/lib/entities-server";
import { timeline } from "../../apps/web/src/lib/timeline-server";

const target = process.argv[2];
const extra = process.argv.slice(3); // extra entity ids whose names define the pool (e.g. the site)
const E = entities();
const ids = [target, ...extra];
const names = ids.flatMap((id) => [...(E.get(id)?.names ?? []).map((n) => ({ text: n.text, lang: n.lang })), { text: E.get(id)!.name.ja, lang: "ja" as const }]);
const db = openDb({ readonly: true });
const rows = db.prepare("SELECT id, source_id, lang, text, norm FROM passages WHERE kind != 'index'").all() as {
  id: string;
  source_id: string;
  lang: "en" | "ja";
  text: string;
  norm: string;
}[];
const tl = timeline().t;
const evidence = new Set<string>();
for (const e of tl.existence_events) if (ids.includes(e.entity)) e.evidence.forEach((x) => evidence.add(x.split(":").slice(0, 3).join(":")));
for (const s of tl.source_times)
  for (const [ent, v] of Object.entries(s.subjects ?? {})) if (ids.includes(ent)) (v.relation?.evidence ?? []).forEach((x) => evidence.add(x.split(":").slice(0, 3).join(":")));

for (const r of rows) {
  const hit = names.filter((n) => n.lang === r.lang).filter((n) => {
    const t = normalizeForSearch(n.text);
    return r.lang === "en" ? new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(r.norm) : r.norm.includes(t);
  });
  if (!hit.length && !evidence.has(r.id)) continue;
  console.log([r.id, r.lang, evidence.has(r.id) ? "EV" : "", hit.map((h) => h.text).join("|"), r.text.replace(/\s+/g, " ").slice(0, 220)].join("\t"));
}
