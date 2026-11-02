import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Entities, EntityDictionary } from "./entities";
import { findNames, namePatterns } from "./names";

const E = new Entities(
  EntityDictionary.parse(JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "..", "..", "corpus", "entities.json"), "utf8"))),
);
const P = namePatterns(E);
const names = (t: string, lang: "en" | "ja" = "en") => findNames("s", t, lang, P).map((n) => [n.text, n.entity]);

describe("findNames (言の地層, RAG-01)", () => {
  it("Kwan-non Temple is the temple; Kwan-non alone is the deity", () => {
    expect(names("Kwan-non Temple—Uniformity of Temple Architecture")).toEqual([["Kwan-non Temple", "ent:sensoji"]]);
    expect(names("is dedicated to the “thousand-armed” Kwan-non, the goddess of mercy.")).toEqual([
      ["Kwan-non", "ent:kannon"],
      ["goddess of mercy", "ent:kannon"],
    ]);
  });

  it("keeps the writer's spelling (Ni-ô, Uyéno style diacritics)", () => {
    expect(names("Under the gateway on either side are the Ni-ô, or two kings")).toEqual([["Ni-ô", "ent:hozomon"]]);
  });

  it("does not match inside words", () => {
    expect(names("the union of Nippon")).toEqual([]);
  });

  it("Japanese: longest first (浅草寺 not 浅草), and 金龍山 / 雷門 / 二王門 separately", () => {
    expect(names("浅草寺の山号は金龍山。雷門は既に焼失したが二王門は残る。", "ja")).toEqual([
      ["浅草寺", "ent:sensoji"],
      ["金龍山", "ent:sensoji"],
      ["雷門", "ent:kaminarimon"],
      ["二王門", "ent:hozomon"],
    ]);
  });

  it("風雷神門 is one name of Kaminarimon (not 雷門 + extra)", () => {
    expect(names("元々雷門はこの二神の名前から「風雷神門」と呼ばれていた", "ja")).toEqual([
      ["雷門", "ent:kaminarimon"],
      ["風雷神門", "ent:kaminarimon"],
    ]);
  });
});
