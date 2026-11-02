import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { Entities, EntityDictionary } from "./entities";

const dict = EntityDictionary.parse(
  JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "..", "..", "corpus", "entities.json"), "utf8")),
);
const E = new Entities(dict);

describe("entity dictionary", () => {
  it("parses and has a consistent hierarchy", () => {
    expect(E.ancestors("ent:kaminarimon").map((e) => e.id)).toEqual(["ent:kaminarimon", "ent:sensoji", "ent:asakusa"]);
  });

  it("keeps Kannon (deity) separate from Sensō-ji (site) (RAG-01)", () => {
    expect(E.findByName("Kwan-non")?.id).toBe("ent:kannon");
    expect(E.findByName("Kwannon")?.id).toBe("ent:kannon");
    expect(E.findByName("浅草寺")?.id).toBe("ent:sensoji");
    expect(E.findByName("Kwan-non Temple")?.id).toBe("ent:sensoji");
  });

  it("does not map Ni-ô to Kaminarimon", () => {
    expect(E.findByName("Ni-ô")?.id).toBe("ent:hozomon");
  });

  it("matches Claude's place candidate to the most specific entity", () => {
    const h = [
      { name_ja: "浅草", name_en: "Asakusa, Taitō, Tokyo" },
      { name_ja: "金龍山浅草寺", name_en: "Sensō-ji Temple" },
      { name_ja: "雷門（風雷神門）", name_en: "Kaminarimon (Thunder Gate)" },
    ];
    expect(E.matchPlace(h)?.id).toBe("ent:kaminarimon");
  });

  it("returns null for an unknown place (FR-19)", () => {
    expect(E.matchPlace([{ name_ja: "大阪城", name_en: "Osaka Castle" }])).toBeNull();
  });
});
