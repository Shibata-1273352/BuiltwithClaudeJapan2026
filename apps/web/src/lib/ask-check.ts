/**
 * Pull the thread (FR-60): the pure half — what Claude is given (search results, one text block per
 * sentence, so a citation is always whole sentences) and the code check of what it answered.
 * A citation survives only if its quoted text is really in that passage of the corpus; an answer
 * with no surviving citation is "not in the sources", whatever Claude wrote.
 */
export type AskPassage = { passageId: string; sourceId: string; title: string; year: number | null; lang: "ja" | "en"; sentences: string[] };

export type AskCitation = { passageId: string; sourceId: string; title: string; year: number | null; quote: string };
export type AskSegment = { text: string; cites: AskCitation[] };
export type AskAnswer =
  | { ok: true; segments: AskSegment[]; dropped: number }
  | { ok: false; reason: "not_in_sources" | "refused"; dropped: number };

/** The marker Claude is told to answer with when the sources do not cover the question. */
export const NOT_IN_SOURCES = "NOT_IN_SOURCES";

export function searchResults(ps: AskPassage[]) {
  return ps.map((p) => ({
    type: "search_result" as const,
    source: p.passageId,
    title: `${p.title}${p.year ? ` (${p.year})` : ""}`,
    content: p.sentences.map((s) => ({ type: "text" as const, text: s })),
    citations: { enabled: true },
  }));
}

const norm = (s: string) => s.replace(/\s+/g, " ").trim();

type Block = { type: string; text?: string; citations?: { type: string; search_result_index?: number; cited_text?: string; source?: string }[] | null };

/** Keep each text block; keep only the citations whose text is really in the cited passage. */
export function checkAnswer(content: Block[], ps: AskPassage[], stopReason: string | null): AskAnswer {
  if (stopReason === "refusal") return { ok: false, reason: "refused", dropped: 0 };
  let dropped = 0;
  const segments: AskSegment[] = [];
  for (const b of content) {
    if (b.type !== "text" || !b.text) continue;
    const cites: AskCitation[] = [];
    for (const c of b.citations ?? []) {
      const p = c.type === "search_result_location" && c.search_result_index !== undefined ? ps[c.search_result_index] : undefined;
      const quote = norm(c.cited_text ?? "");
      const whole = p ? norm(p.sentences.join(" ")) : "";
      if (!p || !quote || !whole.includes(quote) || (c.source && c.source !== p.passageId)) {
        dropped++;
        continue;
      }
      if (!cites.some((x) => x.passageId === p.passageId && x.quote === quote)) cites.push({ passageId: p.passageId, sourceId: p.sourceId, title: p.title, year: p.year, quote });
    }
    segments.push({ text: b.text, cites });
  }
  const text = segments.map((s) => s.text).join("");
  if (text.includes(NOT_IN_SOURCES) || !segments.some((s) => s.cites.length > 0)) return { ok: false, reason: "not_in_sources", dropped };
  return { ok: true, segments, dropped };
}

/** A visitor's question: one line, short, no markup. */
export function cleanQuestion(q: unknown): string | null {
  if (typeof q !== "string") return null;
  const s = q.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
  return s.length >= 2 && s.length <= 200 ? s : null;
}
