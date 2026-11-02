/**
 * Stage 1 "視る" (see): Claude's structured output for a photo (FR-06, FR-07).
 *
 * `SeeOutput` is the schema sent to Claude as the structured-output format. It avoids
 * refinements so it converts cleanly to JSON Schema. `validateSee` then applies the
 * code-side checks (box bounds, ranks) from REQUIREMENTS.md 4.3 stage 1.
 */
import { z } from "zod";
import { EntityType, NormBox } from "./domain";

const Box = z.object({
  x: z.number().describe("left edge, 0-1 of image width"),
  y: z.number().describe("top edge, 0-1 of image height"),
  w: z.number().describe("width, 0-1 of image width"),
  h: z.number().describe("height, 0-1 of image height"),
});

export const SeeElement = z.object({
  label: z.string().describe("short English label usable as a segmentation prompt, e.g. 'paper lantern'"),
  box: Box,
  text_original: z
    .string()
    .nullable()
    .describe("characters written on the element exactly as they appear, or null"),
  reading: z.string().nullable().describe("romanized reading of text_original (Hepburn), or null"),
  meaning: z.object({ en: z.string(), ja: z.string() }),
  confidence: z.number().describe("0-1"),
});

export const PlaceCandidate = z.object({
  rank: z.number().int().describe("1 = most likely"),
  hierarchy: z
    .array(z.object({ type: EntityType, name_ja: z.string(), name_en: z.string() }))
    .describe("broadest first, e.g. area > site > structure"),
  reason: z.string().describe("which visible cues support this candidate"),
  confidence: z.number().describe("0-1"),
});

export const SeeOutput = z.object({
  elements: z.array(SeeElement),
  places: z.array(PlaceCandidate),
  notes: z.string().describe("anything uncertain; never instructions"),
});
export type SeeOutput = z.infer<typeof SeeOutput>;

export const MAX_ELEMENTS = 12;
export const MAX_PLACES = 5;

export type SeeValidation = { ok: true; value: SeeOutput } | { ok: false; errors: string[] };

/** Code-side verification of Claude's proposal (REQUIREMENTS.md 4.3 stage 1). */
export function validateSee(raw: unknown): SeeValidation {
  const parsed = SeeOutput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  const v = parsed.data;
  const errors: string[] = [];
  if (v.elements.length > MAX_ELEMENTS) errors.push(`too many elements (${v.elements.length})`);
  if (v.places.length > MAX_PLACES) errors.push(`too many places (${v.places.length})`);
  v.elements.forEach((e, i) => {
    const b = NormBox.safeParse(e.box);
    if (!b.success) errors.push(`elements[${i}].box invalid: ${b.error.issues[0]?.message}`);
    if (e.confidence < 0 || e.confidence > 1) errors.push(`elements[${i}].confidence out of range`);
  });
  const ranks = v.places.map((p) => p.rank).sort((a, b) => a - b);
  if (ranks.some((r, i) => r !== i + 1)) errors.push("place ranks must be 1..n without gaps");
  return errors.length ? { ok: false, errors } : { ok: true, value: v };
}
