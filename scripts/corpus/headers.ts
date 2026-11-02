/**
 * Context headers (FR-54, REQUIREMENTS.md 4.4.2 step 2a).
 * One Claude call per chapter: it reads the chapter and returns, for each passage, 1–2 sentences on
 * what the passage is about, plus the chapter's date/place only when the text states them
 * (anything inferred is marked "estimated"). Headers are used for indexing/search only, never quoted.
 *
 *   npm run corpus:headers -- bird-unbeaten --chapters 6     # one chapter (try first)
 *   npm run corpus:headers -- --all                          # everything not yet done
 *   npm run corpus:headers -- --all --force                  # redo
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { UNTRUSTED_POLICY, normalizeForSearch, wrapUntrusted } from "@tsumugi/core";
import { z } from "zod";
import { CLAUDE_MODEL, claude, costOf } from "../../apps/web/src/lib/claude";
import { openDb } from "../../apps/web/src/lib/corpus/db";

const HeaderOut = z.object({
  chapter: z.object({
    date: z.string().nullable().describe("date of the events/writing as stated in the text, e.g. 'June 9, 1878' or '慶応元年十二月'; null if not stated"),
    date_basis: z.enum(["stated", "estimated", "none"]),
    place: z.string().nullable().describe("main place as stated in the text; null if not stated"),
    place_basis: z.enum(["stated", "estimated", "none"]),
  }),
  passages: z.array(z.object({ para: z.number().int(), about: z.string().describe("1-2 sentences, same language as the passage") })),
});

const SYSTEM = `You write short context headers for passages of a historical book, used only to improve search indexing (never shown as quotations).
For each passage listed, write 1–2 sentences in the passage's own language saying what it is about: which places, buildings, people, deities or events it concerns, and whether the writer observed them, heard about them, or merely mentions them.
For the chapter, give the date and the main place only if the text states them ("stated"). If you infer them from context, mark "estimated". If unknown, use null and "none".
Never add facts that are not in the text. Do not identify a gate or building unless the text names it.
${UNTRUSTED_POLICY}`;

const args = process.argv.slice(2);
const force = args.includes("--force");
const all = args.includes("--all");
const chIdx = args.indexOf("--chapters");
const chapterFilter = chIdx >= 0 ? new Set(args[chIdx + 1].split(",").map(Number)) : null;
const only = args.filter((a, i) => !a.startsWith("--") && !(chIdx >= 0 && i === chIdx + 1));
if (!all && !only.length) throw new Error("give source ids or --all");

const db = openDb();
type Ch = { source_id: string; idx: number; label: string; title: string; author: string; lang: "en" | "ja" };
const chapters = (
  db
    .prepare(
      `SELECT c.source_id, c.idx, c.label, s.title, s.author, s.lang FROM chapters c JOIN sources s ON s.id = c.source_id
       WHERE c.kind != 'index' AND s.type = 'book' ORDER BY c.source_id, c.idx`,
    )
    .all() as Ch[]
).filter((c) => (all || only.includes(c.source_id)) && (!chapterFilter || chapterFilter.has(c.idx)));

const getPassages = db.prepare("SELECT id, para, text, header FROM passages WHERE source_id = ? AND chapter = ? ORDER BY para");
const update = db.prepare("UPDATE passages SET header = ?, header_json = ? WHERE id = ?");
const updFts = (lang: string) => db.prepare(`UPDATE fts_${lang} SET header = ? WHERE passage_id = ?`);

let cost = 0;
let done = 0;
const CONCURRENCY = 6;

async function run(ch: Ch) {
  const ps = getPassages.all(ch.source_id, ch.idx) as { id: string; para: number; text: string; header: string | null }[];
  if (!ps.length || (!force && ps.every((p) => p.header))) return;
  const body = ps.map((p) => wrapUntrusted(`para:${p.para}`, p.text)).join("\n");
  const user = `Book: ${ch.title} — ${ch.author}\nChapter: ${ch.label}\n\n${body}`;
  const t0 = Date.now();
  const res = await claude().beta.messages.create(
    {
      model: CLAUDE_MODEL,
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "low", format: betaZodOutputFormat(HeaderOut) },
      system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    },
    { timeout: 300_000 },
  );
  cost += costOf(res.usage);
  const text = res.content.find((b) => b.type === "text")?.text;
  const parsed = HeaderOut.safeParse(text ? JSON.parse(text) : null);
  if (!parsed.success) {
    console.error(`${ch.source_id}:${ch.idx} invalid output (${res.stop_reason})`);
    return;
  }
  const { chapter, passages } = parsed.data;
  const byPara = new Map(passages.map((p) => [p.para, p.about]));
  const ctx = [
    `${ch.title} (${ch.author})`,
    ch.label,
    chapter.date ? `${chapter.date}${chapter.date_basis === "estimated" ? " [estimated]" : ""}` : null,
    chapter.place ? `${chapter.place}${chapter.place_basis === "estimated" ? " [estimated]" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" / ");
  const fts = updFts(ch.lang);
  db.transaction(() => {
    for (const p of ps) {
      const about = byPara.get(p.para) ?? "";
      const header = `${ctx}: ${about}`.trim();
      update.run(header, JSON.stringify({ ...chapter, about, model: res.model, generated_at: new Date().toISOString() }), p.id);
      fts.run(normalizeForSearch(header), p.id);
    }
  })();
  done++;
  console.log(
    `${ch.source_id}:${ch.idx} ${ch.label} — ${ps.length} passages, ${passages.length} headers, ${Date.now() - t0} ms, $${costOf(res.usage).toFixed(3)}`,
  );
}

const queue = [...chapters];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let ch = queue.shift(); ch; ch = queue.shift()) {
      try {
        await run(ch);
      } catch (e) {
        console.error(`${ch.source_id}:${ch.idx} failed: ${(e as Error).message}`);
      }
    }
  }),
);
console.log(`\n${done} chapters, total ≈ $${cost.toFixed(2)}`);
db.close();
