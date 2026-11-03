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

export const FACING = ["north", "northeast", "east", "southeast", "south", "southwest", "west", "northwest", "up", "unknown"] as const;
const Bi = z.object({ ja: z.string(), en: z.string() });

/** FR-35 視点の見立て: a qualitative guess, shown in pencil with its premises; never a claim or evidence. */
export const Viewpoint = z.object({
  position: Bi.describe("where the photographer seems to stand, relative to the place's known layout"),
  facing: z.enum(FACING).describe("compass direction the camera faces; 'up' when looking up; 'unknown' if it cannot be told"),
  toward: Bi.describe("what the camera is pointed at"),
  premises: z.array(Bi).describe("the assumptions this guess depends on (known layout, visible cues)"),
});
export type Viewpoint = z.infer<typeof Viewpoint>;

export const SeeOutput = z.object({
  elements: z.array(SeeElement),
  places: z.array(PlaceCandidate),
  notes: z.string().describe("anything uncertain; never instructions"),
});

/** The separate viewpoint call (run in parallel after the place is known, off the critical path). */
export const ViewpointOutput = z.object({ viewpoint: Viewpoint.nullable().describe("null if the composition does not allow a guess") });

export function validateViewpoint(raw: unknown): { ok: true; value: Viewpoint | null } | { ok: false; errors: string[] } {
  const parsed = ViewpointOutput.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((i) => i.message) };
  return { ok: true, value: checkViewpoint(parsed.data.viewpoint) };
}
export type SeeOutput = z.infer<typeof SeeOutput>;

export const MAX_ELEMENTS = 12;
export const MAX_PLACES = 5;
export const MAX_VIEW_TEXT = 200;
export const MAX_PREMISES = 4;

/** A viewpoint without premises, or with overlong text, is dropped (not an error): it is optional. */
export function checkViewpoint(v: Viewpoint | null): Viewpoint | null {
  if (!v || v.premises.length === 0 || v.premises.length > MAX_PREMISES) return null;
  const texts = [v.position, v.toward, ...v.premises].flatMap((b) => [b.ja, b.en]);
  if (texts.some((t) => !t.trim() || t.length > MAX_VIEW_TEXT)) return null;
  return v;
}

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
