/**
 * Name usages found in source text (言の地層, FR-24, RAG-01). Deterministic: dictionary names are
 * matched against the canonical sentence, longest first and without overlaps, so
 * "Kwan-non Temple" is one usage of Sensō-ji, not also a usage of Kannon.
 */
import type { Entities } from "./entities";

export type FoundName = {
  entity: string;
  text: string; // exactly as written in the source
  dictionaryText: string;
  lang: "en" | "ja";
  specificity: "unique" | "ambiguous";
  sentenceId: string;
  start: number; // code-point offset in the canonical sentence
};

type Pattern = { entity: string; name: string; lang: "en" | "ja"; specificity: "unique" | "ambiguous"; re: RegExp };

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Build tolerant patterns: hyphen/space variants for romanized names, word boundaries in English. */
export function namePatterns(E: Entities): Pattern[] {
  const out: Pattern[] = [];
  for (const e of E.dict.entities) {
    for (const n of e.names) {
      const body =
        n.lang === "en"
          ? esc(n.text)
              .replace(/\\-|\s+/g, "[-\\s]?")
              .replace(/o/g, "[oôō]")
              .replace(/u/g, "[uūû]")
          : esc(n.text);
      const re = new RegExp(n.lang === "en" ? `(?<![\\p{L}])${body}(?![\\p{L}])` : body, n.lang === "en" ? "giu" : "gu");
      out.push({ entity: e.id, name: n.text, lang: n.lang, specificity: n.specificity, re });
    }
  }
  // longest names first so "Kwan-non Temple" wins over "Kwan-non", "浅草寺" over "浅草"
  return out.sort((a, b) => b.name.length - a.name.length);
}

export function findNames(sentenceId: string, text: string, lang: "en" | "ja", patterns: Pattern[]): FoundName[] {
  const taken: [number, number][] = [];
  const out: FoundName[] = [];
  for (const p of patterns) {
    if (p.lang !== lang) continue;
    p.re.lastIndex = 0;
    for (const m of text.matchAll(p.re)) {
      const s = m.index!;
      const e = s + m[0].length;
      if (taken.some(([a, b]) => s < b && e > a)) continue;
      taken.push([s, e]);
      out.push({
        entity: p.entity,
        text: m[0],
        dictionaryText: p.name,
        lang,
        specificity: p.specificity,
        sentenceId,
        start: [...text.slice(0, s)].length,
      });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
