/**
 * Quick retrieval check against the real corpus (FR-09).
 *   npm run corpus:search
 */
import { openDb } from "../../apps/web/src/lib/corpus/db";
import { rrf, searchEntities, searchRelation } from "../../apps/web/src/lib/corpus/search";

const db = openDb({ readonly: true });
const t0 = performance.now();
const en = rrf([
  searchEntities(db, ["Asakusa", "Kwan-non", "Kwannon"], "en"),
  searchRelation(db, ["Asakusa"], ["temple", "Kwan-non", "gate"], "en"),
]);
const ja = rrf([
  searchEntities(db, ["浅草寺", "雷門", "観音", "金龍山"], "ja"),
  searchRelation(db, ["浅草"], ["観音", "雷門", "仁王門", "二王門"], "ja"),
]);
const ms = Math.round(performance.now() - t0);

const show = (label: string, list: typeof en) => {
  console.log(`\n== ${label}: ${list.length} candidates`);
  for (const c of list.slice(0, 8)) {
    console.log(`${c.rrf.toFixed(4)} [${c.channels.join("")}] ${c.passageId} (${c.chapterLabel}) {${c.matched.join(", ")}}`);
    console.log(`    ${c.text.slice(0, 150)}${c.text.length > 150 ? "…" : ""}`);
  }
};
show("English", en);
show("Japanese", ja);
console.log(`\nretrieval time: ${ms} ms`);
db.close();
