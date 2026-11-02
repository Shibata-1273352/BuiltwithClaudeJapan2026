/**
 * Entity dictionary access (REQUIREMENTS.md 4.4.3, 4.4.4).
 * - matchPlace: map Claude's place candidate (names) to dictionary entities
 * - ancestors: structure -> site -> area (search widening, recorded as ancestor_place)
 */
import { z } from "zod";
import { EntityType } from "./domain";
import { normalizeForSearch } from "./text";

export const NameUsageSeed = z.object({
  text: z.string().min(1),
  lang: z.enum(["en", "ja"]),
  specificity: z.enum(["unique", "ambiguous"]),
  note: z.string().optional(),
});

export const EntitySeed = z.object({
  id: z.string().regex(/^ent:[a-z0-9-]+$/),
  type: EntityType,
  parent: z.string().nullable(),
  name: z.object({ ja: z.string(), en: z.string() }),
  coords: z.object({ lat: z.number(), lon: z.number() }).optional(),
  external_ids: z.record(z.string(), z.string()).optional(),
  names: z.array(NameUsageSeed),
});

export const EntityDictionary = z.object({
  version: z.number(),
  entities: z.array(EntitySeed),
  relations: z.array(z.object({ type: z.string(), from: z.string(), to: z.string(), note: z.string().optional() })),
  relation_vocab: z.record(z.string(), z.object({ en: z.array(z.string()), ja: z.array(z.string()) })),
});
export type EntityDictionary = z.infer<typeof EntityDictionary>;
export type EntitySeed = z.infer<typeof EntitySeed>;

export class Entities {
  private byId: Map<string, EntitySeed>;
  constructor(public readonly dict: EntityDictionary) {
    this.byId = new Map(dict.entities.map((e) => [e.id, e]));
    for (const e of dict.entities) {
      if (e.parent && !this.byId.has(e.parent)) throw new Error(`unknown parent ${e.parent} of ${e.id}`);
    }
  }

  get(id: string): EntitySeed | undefined {
    return this.byId.get(id);
  }

  /** The entity itself first, then its parents up to the area. */
  ancestors(id: string): EntitySeed[] {
    const out: EntitySeed[] = [];
    for (let e = this.byId.get(id); e; e = e.parent ? this.byId.get(e.parent) : undefined) out.push(e);
    return out;
  }

  /** Entity whose name usage matches the text exactly after normalization (unique names first). */
  findByName(text: string): EntitySeed | undefined {
    const n = normalizeForSearch(text);
    let ambiguous: EntitySeed | undefined;
    for (const e of this.dict.entities) {
      for (const u of e.names) {
        if (normalizeForSearch(u.text) !== n) continue;
        if (u.specificity === "unique") return e;
        ambiguous ??= e;
      }
      if (normalizeForSearch(e.name.ja) === n || normalizeForSearch(e.name.en) === n) return e;
    }
    return ambiguous;
  }

  /**
   * Match a place candidate (Claude's hierarchy, broadest first) to the most specific known entity.
   * Each level is tried by its Japanese and English names, and also by splitting "雷門（風雷神門）"
   * style parentheses. Returns null when nothing is known (FR-19: say so honestly).
   */
  matchPlace(hierarchy: { name_ja: string; name_en: string }[]): EntitySeed | null {
    let best: EntitySeed | null = null;
    for (const level of hierarchy) {
      const variants = [level.name_ja, level.name_en].flatMap((s) => s.split(/[（）()、,/]| or /).map((x) => x.trim())).filter(Boolean);
      for (const v of variants) {
        const e = this.findByName(v) ?? this.findByName(v.replace(/\s*\(.*\)$/, ""));
        if (e && (!best || this.ancestors(e.id).some((a) => a.id === best!.id))) best = e;
      }
    }
    return best;
  }

  /** Name usages of an entity for a language. */
  names(id: string, lang: "en" | "ja"): { text: string; specificity: "unique" | "ambiguous" }[] {
    return (this.byId.get(id)?.names ?? []).filter((n) => n.lang === lang);
  }
}
