/**
 * Print the chronology-based existence judgment for every source with a time, for one site
 * (review aid; no Claude call).   npx tsx scripts/check-existence.ts ent:kaminarimon
 */
import { timeline, existenceFor } from "../apps/web/src/lib/timeline-server";

const entity = process.argv[2] ?? "ent:kaminarimon";
for (const s of timeline().t.source_times) {
  const j = existenceFor(entity, s.source);
  console.log([s.source, j.value, j.reason, j.time?.kind ?? "-", j.time?.start ?? "-", j.relation?.kind ?? "-"].join("\t"));
}
