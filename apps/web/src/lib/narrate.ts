/**
 * Stage 8 "紡ぐ": narrative from adopted claims only (REQUIREMENTS.md 4.8, FR-17, RAG-07).
 * Claude never sees whole sources here — only claim cards. Code checks every sentence.
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  checkNarrative,
  normalizeForSearch,
  NarrativeOutput,
  UNTRUSTED_POLICY,
  type CheckedClaim,
  type CheckedSentence,
  type Entities,
  type NarrativeClaim,
} from "@tsumugi/core";
import { CLAUDE_MODEL, claude, costOf, rateLimitHeaders, type CallRecord } from "./claude";
import type { ExistenceRow, Thread } from "./dag/threads";

const SYSTEM = `You are the narrator of TSUMUGI. Write a short story (4-7 sentences) for a traveler standing at the place in their photo.
Use ONLY the claim cards given. Every sentence must cite the claim ids it relies on.
- The differences are the story: who wrote about what (a temple, its deity, a gate, a hall, a bridge), and when the photo's structure was or was not there.
- Never say a writer saw something the cards do not say they saw. A card about one place (e.g. the temple) is not about another (e.g. the gate). Hearsay or a distant view is not seeing.
- For an "absent" card, state the reason exactly as the card words it (e.g. "had not yet been rebuilt after the fire", "had not yet been moved here"). If the card says "permanent", never write that there was no structure at all ("there was no gate", "門のない", "gateless"): temporary structures stood in the interim. This applies to interpretive sentences too.
- Keep untranslatable words in the original (観音, Kwan-non, 雷門) and do not invent dates or names.
- In English, never leave bare Japanese script: write the romanization with the original in parentheses at first mention, e.g. "Kaminarimon (雷門)", "Hiyori Geta (日和下駄)"; afterwards the romanization alone. Keep a writer's own spelling as written (Kwan-non).
- No quotations; the app shows original quotes separately.
- assertion_type: direct for what a source states, derived for combined reasoning (existence cards), interpretive for your framing (use sparingly, no new facts).
${UNTRUSTED_POLICY}`;

export type NarrateResult = { sentences: CheckedSentence[]; record: CallRecord; lang: "ja" | "en" };

export function buildClaimCards(
  E: Entities,
  claims: CheckedClaim[],
  threads: Thread[],
  existence: ExistenceRow[],
  sourceTitleOf: (passageId: string) => string,
  sourceTimeOf: (passageId: string) => { kind: string; start: string | null; end?: string | null } | null = () => null,
): Map<string, NarrativeClaim & { card: string }> {
  const out = new Map<string, NarrativeClaim & { card: string }>();
  const withAncestors = (ids: (string | null)[]) => [...new Set(ids.filter(Boolean).flatMap((id) => E.ancestors(id!).map((a) => a.id)))];
  for (const t of threads.filter((x) => x.derivation === "derived")) {
    const src = t.id.replace(/^th:exist:/, "");
    const row = existence.find((r) => r.source === src);
    // claimId = cl:exist:<entity id "ent:x">:<source id>
    const entityId = t.claimId.replace(/^cl:exist:/, "").split(":").slice(0, 2).join(":");
    const entities = withAncestors([entityId]);
    const facts = [t.label.ja, t.label.en, row?.sourceTitle, row?.time?.start, row?.time?.end, row?.period?.start, row?.period?.end].filter(Boolean).join(" ");
    out.set(t.claimId, {
      id: t.claimId,
      entities,
      facts,
      derived: true,
      card: `${t.claimId} [${t.state}, derived] ${t.label.ja} / ${t.label.en} (source time ${row?.time?.kind} ${row?.time?.start ?? "?"}${row?.time?.end ? `–${row.time.end}` : ""}; verified period ${row?.period?.start ?? "?"}–${row?.period?.end ?? "?"})`,
    });
  }
  for (const c of claims.filter((x) => x.status !== "rejected")) {
    const th = threads.find((t) => t.claimId === c.id);
    if (!th) continue;
    const subj = E.get(c.subject);
    const obj = c.object ? E.get(c.object) : undefined;
    const title = sourceTitleOf(c.passage_id);
    // The source's time (observed/written/depicted) is part of a claim's provenance (TemporalValue).
    const st = sourceTimeOf(c.passage_id);
    const when = st ? `${st.kind} ${st.start}${st.end ? `–${st.end}` : ""}` : "";
    const facts = [th.label.ja, th.label.en, title, when, c.value, c.excerpt, subj?.name.ja, subj?.name.en, obj?.name.ja, obj?.name.en]
      .filter(Boolean)
      .join(" ");
    out.set(c.id, {
      id: c.id,
      entities: withAncestors([c.subject, c.object]),
      facts,
      derived: false,
      card: `${c.id} [${th.state}] source "${title}"${when ? ` (${when})` : ""}: ${subj?.name.en ?? c.subject} — ${c.predicate}${c.value ? ` "${c.value}"` : ""}${obj ? ` → ${obj.name.en}` : ""}`,
    });
  }
  return out;
}

export function nameIndex(E: Entities): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of E.dict.entities) {
    for (const n of [...e.names.map((x) => x.text), ...e.name.ja.split(/[（）()《》]/), ...e.name.en.split(/[()]/)]) {
      const k = normalizeForSearch(n.trim());
      if (k.length >= 2 && !m.has(k)) m.set(k, e.id);
    }
  }
  return m;
}

export async function narrate(
  E: Entities,
  cards: Map<string, NarrativeClaim & { card: string }>,
  lang: "ja" | "en",
  subjectEntities: string[] = [],
): Promise<NarrateResult> {
  const startedAt = new Date();
  const { data, response } = await claude()
    .beta.messages.create(
      {
        model: CLAUDE_MODEL,
        max_tokens: 6000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        thinking: { type: "adaptive" },
        output_config: { effort: "low", format: betaZodOutputFormat(NarrativeOutput) },
        system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: `Write in ${lang === "ja" ? "Japanese" : "English"}.\nClaim cards:\n${[...cards.values()].map((c) => `- ${c.card}`).join("\n")}`,
          },
        ],
      },
      { timeout: 30_000 },
    )
    .withResponse();
  const record: CallRecord = {
    stage: `narrate:${lang}`,
    model: CLAUDE_MODEL,
    servedModel: data.model,
    startedAt: startedAt.toISOString(),
    elapsedMs: Date.now() - startedAt.getTime(),
    stopReason: data.stop_reason,
    usage: {
      input: data.usage.input_tokens,
      output: data.usage.output_tokens,
      cacheRead: data.usage.cache_read_input_tokens ?? 0,
      cacheWrite: data.usage.cache_creation_input_tokens ?? 0,
    },
    costUsd: costOf(data.usage),
    rateLimit: rateLimitHeaders(response.headers),
    requestId: response.headers.get("request-id"),
  };
  const text = data.content.find((b) => b.type === "text")?.text;
  const parsed = text && data.stop_reason !== "refusal" ? NarrativeOutput.safeParse(JSON.parse(text)) : null;
  const sentences = parsed?.success ? checkNarrative(parsed.data.sentences, cards, nameIndex(E), subjectEntities) : [];
  return { sentences, record, lang };
}
