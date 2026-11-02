/**
 * Domain schemas for the Evidence Graph (REQUIREMENTS.md section 3 and section 7).
 * These are the shapes the code validates; Claude proposals are checked against them.
 */
import { z } from "zod";

export const EntityType = z.enum(["area", "site", "structure", "deity", "artwork", "person", "concept"]);
export type EntityType = z.infer<typeof EntityType>;

export const Entity = z.object({
  id: z.string().min(1).max(128),
  type: EntityType,
  parentId: z.string().max(128).nullable(),
  name: z.object({ ja: z.string().optional(), en: z.string().optional() }),
  coords: z.object({ lat: z.number(), lon: z.number() }).optional(),
  externalIds: z.record(z.string(), z.string()).optional(),
});
export type Entity = z.infer<typeof Entity>;

export const Specificity = z.enum(["unique", "ambiguous"]);

export const TimeKind = z.enum([
  "observed_at",
  "written_at",
  "first_published_at",
  "edition_published_at",
  "depicted_at",
]);
export const TimePrecision = z.enum(["day", "month", "year", "range", "unknown"]);

/** ISO-like partial date: "1878", "1878-06", "1878-06-09". */
const PartialDate = z.string().regex(/^-?\d{1,4}(-\d{2}(-\d{2})?)?$/);

export const TemporalValue = z.object({
  start: PartialDate.nullable(),
  end: PartialDate.nullable(),
  precision: TimePrecision,
  kind: TimeKind,
  calendar: z.enum(["gregorian", "japanese_lunisolar"]).default("gregorian"),
  evidenceId: z.string().nullable(),
});
export type TemporalValue = z.infer<typeof TemporalValue>;

export const Derivation = z.enum(["direct", "derived", "interpretive"]);
export const EvidenceRelation = z.enum(["supports", "contradicts", "context_only"]);
export const Review = z.enum(["rule_checked", "model_assessed", "human_reviewed", "unreviewed"]);
export const Existence = z.enum(["present", "absent", "unknown"]);

export const Layer = z.enum(["toki", "ba", "koto", "ma"]); // 時・場・言・間
export const DisplayState = z.enum([
  "ink",
  "combined",
  "absent",
  "conflict",
  "pencil",
  "pending",
  "user_confirmed",
]);

/** Normalized box, origin top-left, all values in [0, 1]. */
export const NormBox = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  })
  .refine((b) => b.x + b.w <= 1.0001 && b.y + b.h <= 1.0001, "box exceeds image bounds");
export type NormBox = z.infer<typeof NormBox>;
