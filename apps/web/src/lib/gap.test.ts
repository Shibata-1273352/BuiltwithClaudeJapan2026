import { readFileSync } from "node:fs";
import path from "node:path";
import { Entities, EntityDictionary } from "@tsumugi/core";
import { describe, expect, it } from "vitest";
import { validateGaps, type GapOutput } from "./gap";

const E = new Entities(
  EntityDictionary.parse(JSON.parse(readFileSync(path.join(import.meta.dirname, "../../../../corpus/entities.json"), "utf8"))),
);

describe("validateGaps (FR-20, ASI02, SEC-04)", () => {
  const out = (gaps: GapOutput["gaps"]): GapOutput => ({ assessment: "", enough: false, gaps });

  it("keeps known entities and plain short terms", () => {
    const v = validateGaps(out([{ facet: "naming", lang: "ja", entity: "ent:sensoji", reason: "", terms: ["金龍山", "浅草観音"] }]), E);
    expect(v).toHaveLength(1);
    expect(v[0].terms).toEqual(["金龍山", "浅草観音"]);
  });

  it("drops unknown entities, caps gaps at 3 and terms at 4", () => {
    const g = (entity: string) => ({ facet: "naming" as const, lang: "en" as const, entity, reason: "", terms: ["a", "b", "c", "d", "e"] });
    const v = validateGaps(out([g("ent:osaka"), g("ent:sensoji"), g("ent:kannon"), g("ent:asakusa"), g("ent:nakamise")]), E);
    expect(v.map((x) => x.entity)).toEqual(["ent:sensoji", "ent:kannon", "ent:asakusa"]);
    expect(v[0].terms).toHaveLength(4);
  });

  it("rejects query syntax and over-long terms (no FTS/SQL injection surface)", () => {
    const v = validateGaps(
      out([{ facet: "naming", lang: "en", entity: "ent:sensoji", reason: "", terms: ['temple" OR "x', "NEAR(a b)", "x".repeat(31), "temple"] }]),
      E,
    );
    expect(v[0].terms).toEqual(["temple"]);
    expect(v[0].rejectedTerms).toHaveLength(3);
  });

  it("drops a gap whose terms were all rejected", () => {
    expect(validateGaps(out([{ facet: "naming", lang: "en", entity: "ent:sensoji", reason: "", terms: ["*;DROP"] }]), E)).toEqual([]);
  });
});
