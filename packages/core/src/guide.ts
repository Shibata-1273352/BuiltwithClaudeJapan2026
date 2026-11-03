/**
 * The guide notes (Loom): for each object Claude read in the photo — what you are seeing, why it
 * matters, what to try — plus how its kanji are built and three questions worth asking.
 * They are Claude's explanations, NOT evidence: shown as guide notes (silk threads), never turned
 * into claims, ink threads or graph nodes. Code drops what it can check is wrong or too long.
 */
import { z } from "zod";

const Bi = z.object({ ja: z.string(), en: z.string() });

export const GuideKanji = z.object({
  char: z.string().describe("one kanji that appears in the element's text_original"),
  meaning: Bi.describe("the kanji's meaning, a few words"),
  parts: z.array(z.object({ part: z.string().describe("one component character"), meaning: Bi })).describe("its components (radicals), 1-3"),
});

export const GuideNote = z.object({
  element: z.number().int().describe("index of the element in the list given (0-based)"),
  name: Bi.describe("a short name for the element, e.g. 舎利殿 / Reliquary hall (≤ 12 字 / 5 words)"),
  what: Bi.describe("what the traveler is looking at: one concrete, sensory detail (≤ 15 words / 40 字)"),
  why: Bi.describe("why it matters in Japanese culture (≤ 20 words / 50 字)"),
  try: Bi.describe("one thing to do or notice there (≤ 15 words / 40 字)"),
  kanji: z.array(GuideKanji).describe("up to 2 kanji from text_original, the most interesting first"),
  questions: z.array(Bi).describe("3 short questions a curious visitor would ask next"),
});

export const GuideOutput = z.object({ notes: z.array(GuideNote) });
export type GuideNote = z.infer<typeof GuideNote>;
export type GuideOutput = z.infer<typeof GuideOutput>;

const LIMIT = { en: 200, ja: 80 }; // characters per field (the prompt asks for ~half; code rejects the overlong)
const CJK = /^[㐀-鿿豈-﫿⺀-⿟㇀-㇯]$/u;
const tooLong = (b: { ja: string; en: string }) => !b.ja.trim() || !b.en.trim() || b.ja.length > LIMIT.ja || b.en.length > LIMIT.en;

export type GuideElement = { text_original: string | null };

/**
 * Code checks: a note must point at a real element; a too-long or empty field drops the note;
 * a kanji must occur in that element's text and its parts must be single CJK characters
 * (otherwise just that kanji is dropped); at most 2 kanji and 3 questions are kept.
 */
export function validateGuide(out: GuideOutput, elements: GuideElement[]): { notes: GuideNote[]; dropped: { element: number; reason: string }[] } {
  const notes: GuideNote[] = [];
  const dropped: { element: number; reason: string }[] = [];
  const seen = new Set<number>();
  for (const n of out.notes) {
    const el = elements[n.element];
    if (!el) {
      dropped.push({ element: n.element, reason: "no_such_element" });
      continue;
    }
    if (seen.has(n.element)) {
      dropped.push({ element: n.element, reason: "duplicate" });
      continue;
    }
    if ([n.what, n.why, n.try].some(tooLong) || (n.name && (n.name.ja.length > 24 || n.name.en.length > 60))) {
      dropped.push({ element: n.element, reason: "too_long_or_empty" });
      continue;
    }
    const text = el.text_original ?? "";
    const kanji = n.kanji
      .filter((k) => CJK.test(k.char) && text.includes(k.char) && k.parts.length > 0 && k.parts.length <= 3 && k.parts.every((p) => CJK.test(p.part) || /^[⺀-⿿]$/u.test(p.part)))
      .slice(0, 2);
    const questions = n.questions.filter((q) => q.ja.trim() && q.en.trim() && q.ja.length <= 60 && q.en.length <= 120).slice(0, 3);
    seen.add(n.element);
    notes.push({ ...n, kanji, questions });
  }
  return { notes, dropped };
}
