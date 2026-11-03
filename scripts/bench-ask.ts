/**
 * Pull the thread on a stored run: time, cost and what survives the citation check.
 *   npx tsx --env-file=.env scripts/bench-ask.ts <exploration id> "<question>" [ja|en] ...
 */
import { ask } from "../apps/web/src/lib/ask";

const [id, ...rest] = process.argv.slice(2);
if (!id) throw new Error("usage: bench-ask.ts <exploration id> <question> [lang] ...");
let total = 0;
for (let i = 0; i < rest.length; i++) {
  const q = rest[i];
  const lang = rest[i + 1] === "en" || rest[i + 1] === "ja" ? (rest[++i] as "ja" | "en") : "ja";
  const r = await ask(id, q, lang, "雷門 / Kaminarimon");
  total += r.record?.costUsd ?? 0;
  console.log(`\n? ${q} [${lang}]  ${((r.record?.elapsedMs ?? 0) / 1000).toFixed(1)} s · $${(r.record?.costUsd ?? 0).toFixed(4)} · ${r.passages} passages · ${r.record?.servedModel}`);
  if (r.answer.ok) for (const s of r.answer.segments) console.log(`  ${s.text.trim()}${s.cites.map((c) => `\n     ↳ ${c.title}${c.year ? ` ${c.year}` : ""}: “${c.quote.slice(0, 90)}”`).join("")}`);
  else console.log(`  (${r.answer.reason})`);
  console.log(`  dropped citations: ${r.answer.dropped}`);
}
console.log(`\ntotal $${total.toFixed(4)}`);
