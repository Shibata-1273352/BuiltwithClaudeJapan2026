/**
 * RAG-08 check on the latest exploration: switching language must not change Claim/Thread ids or
 * states. Threads are emitted once (language-independent); every narrative (ja, en) may only cite
 * claim ids that exist in that exploration.
 *   npx tsx --env-file=.env scripts/check-rag08.ts [explorationId]
 */
import { openDb } from "../apps/web/src/lib/corpus/db";

const db = openDb();
const id =
  process.argv[2] ??
  (db.prepare("SELECT exploration_id AS id FROM narratives GROUP BY exploration_id HAVING count(*) = 2 ORDER BY max(created_at) DESC LIMIT 1").get() as
    | { id: string }
    | undefined)?.id;
if (!id) throw new Error("no exploration with both ja and en narratives");

const ev = (type: string) =>
  (db.prepare("SELECT data_json FROM events WHERE exploration_id = ? AND type = ? ORDER BY seq").all(id, type) as { data_json: string }[]).map((r) =>
    JSON.parse(r.data_json),
  );
const threadEvents = ev("threads");
const threads = threadEvents[0] as { id: string; claimId: string; state: string }[];
const claimIds = new Set([...ev("claims").flatMap((e) => e.claims.map((c: { id: string }) => c.id)), ...threads.map((t) => t.claimId)]);
const narr = db.prepare("SELECT lang, json FROM narratives WHERE exploration_id = ?").all(id) as { lang: string; json: string }[];

const result = {
  exploration: id,
  threadEvents: threadEvents.length, // must be 1: threads are computed once, before any language
  threads: threads.length,
  narratives: Object.fromEntries(
    narr.map((n) => {
      const p = JSON.parse(n.json) as { sentences: { claim_ids: string[] }[] };
      const cited = p.sentences.flatMap((s) => s.claim_ids);
      return [n.lang, { sentences: p.sentences.length, cited: cited.length, unknown: cited.filter((c) => !claimIds.has(c)) }];
    }),
  ),
};
const ok = result.threadEvents === 1 && Object.values(result.narratives).every((n) => n.unknown.length === 0);
console.log(JSON.stringify({ ...result, ok }, null, 2));
process.exitCode = ok ? 0 : 1;
