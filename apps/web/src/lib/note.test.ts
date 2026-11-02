import { describe, expect, it } from "vitest";
import type { StoredEvent } from "./dag/events";
import { buildNote, toTranslate, type SourceMeta } from "./note";
import { checkTranslations } from "./translate";

const src = (id: string, lang: string, title: string): SourceMeta => ({
  id,
  type: "book",
  lang,
  title,
  author: "a",
  first_published: 1880,
  edition: null,
  url: "https://example.org",
  provider: null,
  license: "PD",
});
const sources = new Map([
  ["bird-unbeaten", src("bird-unbeaten", "en", "Unbeaten Tracks in Japan")],
  ["koun-kaiko", src("koun-kaiko", "ja", "幕末維新懐古談")],
  ["unused", src("unused", "en", "Unused")],
]);
const ev = (seq: number, type: string, data: unknown): StoredEvent => ({ seq, type, data }) as StoredEvent;
const events = [
  ev(1, "place", { chosen: { entity: "ent:kaminarimon", path: [{ name: { ja: "雷門" } }, { name: { ja: "浅草寺" } }, { name: { ja: "浅草" } }] } }),
  ev(2, "claims", {
    claims: [
      { id: "cl:bird:1:r1", passage_id: "bird-unbeaten:6:2", source_id: "bird-unbeaten", source: "Unbeaten Tracks in Japan", lang: "en", subject: "ent:sensoji", predicate: "named_as", value: "Kwan-non", status: "accepted", excerpt: "the temple of Kwan-non", sentence_ids: ["bird-unbeaten:6:2:0"] },
      { id: "cl:koun:1:r1", passage_id: "koun-kaiko:10:0", source_id: "koun-kaiko", source: "幕末維新懐古談", lang: "ja", subject: "ent:kaminarimon", predicate: "destroyed_in", value: null, status: "accepted", excerpt: "雷門もこの時に焼けてしまった", sentence_ids: ["koun-kaiko:10:0:1"] },
      { id: "cl:bad:r1", passage_id: "unused:0:0", source_id: "unused", lang: "en", subject: "x", predicate: "y", value: null, status: "rejected", excerpt: "x", sentence_ids: ["unused:0:0:0"] },
    ],
  }),
  ev(3, "threads", [
    { id: "th:exist:bird-unbeaten", claimId: "cl:exist:ent:kaminarimon:bird-unbeaten", layer: "toki", state: "absent", label: { ja: "不在", en: "absent" }, evidence: ["ex:1"], derivation: "derived" },
  ]),
  ev(4, "narrative", { lang: "ja", sentences: [{ text: "バードは観音の寺を見た。", claim_ids: ["cl:bird:1:r1", "cl:exist:ent:kaminarimon:bird-unbeaten"], assertion_type: "direct" }, { text: "光雲は焼失を語る。", claim_ids: ["cl:koun:1:r1"], assertion_type: "direct" }], dropped: [] }),
  ev(5, "space", { ok: true, url: "/space/cap_x", aligned: true, elements: ["lantern", "people"] }),
  ev(6, "done", { elapsed_ms: 31000, cost_usd: 0.18, claude_calls: 5 }),
];

describe("buildNote (FR-42)", () => {
  const note = buildNote("exp_x", "cap_x", events, sources);
  it("links every cited claim id to evidence or an existence thread", () => {
    for (const s of note.narratives.ja!.sentences) for (const id of s.claim_ids) expect(note.cites[id], id).toBeTruthy();
    expect(note.cites["cl:exist:ent:kaminarimon:bird-unbeaten"]).toMatchObject({ kind: "existence", state: "absent", sourceId: "bird-unbeaten" });
    expect(note.cites["cl:bad:r1"]).toBeUndefined();
  });
  it("issues tickets only for cited sources, counting citations", () => {
    expect(note.tickets.map((t) => [t.id, t.cited])).toEqual([
      ["bird-unbeaten", 2],
      ["koun-kaiko", 1],
    ]);
  });
  it("keeps place path, space and stats", () => {
    expect(note.place?.path).toEqual(["浅草", "浅草寺", "雷門"]);
    expect(note.space).toEqual({ url: "/space/cap_x", aligned: true, elements: ["lantern", "people"] });
    expect(note.stats.claude_calls).toBe(5);
  });
  it("asks to translate only cited originals in the other language", () => {
    expect(toTranslate(note, "ja").map((x) => x.id)).toEqual(["bird-unbeaten:6:2:0"]);
    expect(toTranslate(note, "en").map((x) => x.id)).toEqual(["koun-kaiko:10:0:1"]);
  });
});

describe("checkTranslations", () => {
  it("drops unknown ids and empty text", () => {
    const t = checkTranslations([{ id: "a" }, { id: "b" }], { items: [{ id: "a", text: " 観音の寺 " }, { id: "b", text: " " }, { id: "evil", text: "x" }] });
    expect(t).toEqual({ a: "観音の寺" });
  });
});
