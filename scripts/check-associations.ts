/**
 * FR-59 against the live graph: the associations a Kaminarimon run would show, excluding the
 * passages the recorded run retrieved (fixtures/live/kaminarimon-events.json).
 *   npx tsx --env-file=.env scripts/check-associations.ts [ent:kaminarimon]
 */
import { readFileSync } from "node:fs";
import { findAssociations } from "../apps/web/src/lib/associations";
import { openDb } from "../apps/web/src/lib/corpus/db";

const seed = process.argv[2] ?? "ent:kaminarimon";
const fx = JSON.parse(readFileSync("fixtures/live/kaminarimon-events.json", "utf8")) as { events: { type: string; data: { candidates?: { passageId: string }[] } }[] };
const retrieved = new Set(fx.events.filter((e) => e.type === "candidates").flatMap((e) => (e.data.candidates ?? []).map((c) => c.passageId)));
const corpus = openDb({ readonly: true });
try {
  const r = await findAssociations(seed, retrieved, corpus, 5000);
  console.log(JSON.stringify(r, null, 1));
} finally {
  corpus.close();
  process.exit(0); // the shared driver keeps the event loop alive
}
