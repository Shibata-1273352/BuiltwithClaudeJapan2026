/**
 * Loom guide notes: one small Claude call, text only (the elements Claude read in the photo + the
 * place), in parallel with retrieval — off the critical path. Claude's explanations, labelled as
 * such; code drops what it can check is wrong (validateGuide). Never claims or evidence.
 */
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { GuideOutput, UNTRUSTED_POLICY, validateGuide, type GuideNote, type SeeOutput } from "@tsumugi/core";
import { CLAUDE_LIGHT_MODEL, CLAUDE_MODEL, FAST_BETA, claude, costOf, fastOn, rateLimitHeaders, withFast, type CallRecord } from "./claude";

export const GUIDE_SYSTEM = `You are the guide of TSUMUGI for travelers who love Japan. For the element read in the traveler's photo, write one short guide note, in Japanese and English. Be brief: it is read on the spot, on a phone.
- what: one concrete, sensory detail of what they are looking at (en ≤ 15 words, ja ≤ 40 字).
- why: why it matters in Japanese culture: belief, custom, craft, the meaning of the words (en ≤ 20 words, ja ≤ 50 字).
- try: one thing to do or notice right there: etiquette, a custom, a detail to look for (en ≤ 15 words, ja ≤ 40 字).
- kanji: up to 2 interesting kanji from the element's text, each with its meaning and its 1-3 components with meanings, e.g. 雷 = 雨 (rain) + 田 (field). Meanings: 1-3 words.
- questions: 3 short questions a curious visitor would ask next (en ≤ 8 words, ja ≤ 20 字).
Write warmly and plainly, for a visitor, not an academic. Do not state dates or names you are unsure of; never invent history. These notes are shown as your explanation, separately from the cited sources.
- Do not identify or describe people.
- ${UNTRUSTED_POLICY}`;

/** The elements worth a note: the ones with writing first, then the largest; at most 3. */
export function guideTargets(see: SeeOutput, max = 3): number[] {
  return see.elements
    .map((e, i) => ({ i, text: e.text_original ? 1 : 0, area: e.box.w * e.box.h }))
    .sort((a, b) => b.text - a.text || b.area - a.area)
    .slice(0, max)
    .map((x) => x.i);
}

async function oneNote(see: SeeOutput, index: number, place: { ja: string; en: string }) {
  const startedAt = new Date();
  const model = fastOn() ? CLAUDE_MODEL : CLAUDE_LIGHT_MODEL;
  const e = see.elements[index];
  const line = `0. ${e.label}${e.text_original ? ` — text: ${e.text_original}${e.reading ? ` (${e.reading})` : ""}` : ""}${e.meaning ? ` — ${e.meaning.en}` : ""}`;
  const { data, response } = await withFast((fast) =>
    claude()
      .beta.messages.create(
        {
          model,
          ...(fast ? { speed: "fast" as const } : {}),
          max_tokens: 3000,
          betas: ["server-side-fallback-2026-07-01", ...(fast ? [FAST_BETA] : [])],
          fallbacks: "default",
          output_config: { effort: "low", format: betaZodOutputFormat(GuideOutput) },
          system: [{ type: "text", text: GUIDE_SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: `Place: ${place.ja} / ${place.en}\nElements (write exactly one note, for element 0):\n${line}` }],
        },
        { timeout: 30_000 },
      )
      .withResponse(),
  );
  const record: CallRecord = {
    stage: "guide",
    model,
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
    costUsd: costOf(data.usage, model),
    rateLimit: rateLimitHeaders(response.headers),
    requestId: response.headers.get("request-id"),
  };
  const text = data.content.filter((b) => b.type === "text").at(-1)?.text;
  let out: GuideOutput = { notes: [] };
  try {
    const parsed = text && data.stop_reason !== "refusal" ? GuideOutput.safeParse(JSON.parse(text)) : null;
    if (parsed?.success) out = parsed.data;
  } catch {
    /* invalid JSON: no note */
  }
  // the call saw element 0; map it back to the real index before the checks
  const v = validateGuide({ notes: out.notes.filter((n) => n.element === 0).slice(0, 1).map((n) => ({ ...n, element: index })) }, see.elements);
  return { ...v, record };
}

/**
 * One small call per element, in parallel (a call's time is set by its output; one call for all
 * elements took 26 s). `onNote` fires as each note passes the checks.
 */
export async function guideNotes(
  see: SeeOutput,
  place: { ja: string; en: string },
  onNote?: (n: GuideNote) => void,
): Promise<{ notes: GuideNote[]; dropped: { element: number; reason: string }[]; records: CallRecord[] }> {
  const results = await Promise.all(
    guideTargets(see).map((i) =>
      oneNote(see, i, place).then((r) => {
        for (const n of r.notes) onNote?.(n);
        return r;
      }),
    ),
  );
  return { notes: results.flatMap((r) => r.notes), dropped: results.flatMap((r) => r.dropped), records: results.map((r) => r.record) };
}
