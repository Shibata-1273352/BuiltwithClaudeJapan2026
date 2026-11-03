/**
 * The guide notes for a recorded exploration's see output (real Claude, ~$0.01): latency, cost,
 * what was kept and dropped.
 *   npx tsx --env-file=.env scripts/bench-guide.ts <exploration id>
 */
import path from "node:path";
import Database from "better-sqlite3";
import type { SeeOutput } from "@tsumugi/core";
import { guideNotes } from "../apps/web/src/lib/guide-call";

const id = process.argv[2];
if (!id) throw new Error("usage: bench-guide.ts <exploration id>");
const db = new Database(path.join(process.env.DATA_DIR!, "tsumugi.db"), { readonly: true });
const see = JSON.parse((db.prepare("SELECT data_json FROM events WHERE exploration_id = ? AND type = 'see'").get(id) as { data_json: string }).data_json) as SeeOutput;
const r = await guideNotes(see, { ja: "雷門", en: "Kaminarimon (Thunder Gate)" });
console.log(JSON.stringify({ calls: r.records.map((x) => ({ ms: x.elapsedMs, out: x.usage.output, cost: x.costUsd, model: x.servedModel })), dropped: r.dropped }, null, 1));
console.log(JSON.stringify(r.notes.map((n) => ({ element: n.element, what: n.what.en, kanji: n.kanji.map((k) => `${k.char}=${k.parts.map((p) => p.part).join("+")}`), q: n.questions.map((q) => q.en) })), null, 1));
