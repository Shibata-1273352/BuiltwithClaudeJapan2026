import { describe, expect, it } from "vitest";
import { checkNarrative, type NarrativeClaim } from "./narrative";
import { normalizeForSearch } from "./text";

const claims = new Map<string, NarrativeClaim>([
  [
    "cl:exist:bird",
    {
      id: "cl:exist:bird",
      entities: ["ent:kaminarimon", "ent:sensoji", "ent:asakusa"],
      facts: "Unbeaten Tracks in Japan 1878-06-09 恒久的な雷門は焼失後まだ再建されていなかった 1866 1960",
      derived: true,
    },
  ],
  [
    "cl:bird:kannon",
    { id: "cl:bird:kannon", entities: ["ent:kannon", "ent:sensoji", "ent:asakusa"], facts: "Unbeaten Tracks in Japan Kwan-non named_as", derived: false },
  ],
]);
const nameIndex = new Map(
  Object.entries({ 雷門: "ent:kaminarimon", 浅草寺: "ent:sensoji", 浅草: "ent:asakusa", 観音: "ent:kannon", 宝蔵門: "ent:hozomon" }).map(([k, v]) => [
    normalizeForSearch(k),
    v,
  ]),
);

describe("checkNarrative (FR-17, 4.8)", () => {
  it("accepts a derived sentence that cites the existence claim and only its numbers", () => {
    const [s] = checkNarrative(
      [{ text: "バードが浅草寺について書いた1878年、恒久的な雷門は焼失後まだ再建されていませんでした。", claim_ids: ["cl:exist:bird"], assertion_type: "derived" }],
      claims,
      nameIndex,
    );
    expect(s.ok).toBe(true);
  });

  it("rejects a factual sentence without claims", () => {
    const [s] = checkNarrative([{ text: "雷門は1960年に再建されました。", claim_ids: [], assertion_type: "direct" }], claims, nameIndex);
    expect(s.problems).toContain("no_claims");
  });

  it("rejects unknown claim ids", () => {
    const [s] = checkNarrative([{ text: "雷門。", claim_ids: ["cl:made-up"], assertion_type: "direct" }], claims, nameIndex);
    expect(s.problems).toContain("unknown_claim_id");
  });

  it("rejects a year the claims do not contain", () => {
    const [s] = checkNarrative([{ text: "雷門は1865年に焼けました。", claim_ids: ["cl:exist:bird"], assertion_type: "derived" }], claims, nameIndex);
    expect(s.problems).toContain("number_not_in_claims:1865");
  });

  it("rejects a proper name outside the cited claims (e.g. 宝蔵門)", () => {
    const [s] = checkNarrative([{ text: "バードは宝蔵門で観音を見た。", claim_ids: ["cl:bird:kannon"], assertion_type: "direct" }], claims, nameIndex);
    expect(s.problems).toContain("entity_not_in_claims:ent:hozomon");
  });

  it("allows naming the photo's subject in a contrast, but still not other entities", () => {
    const subject = ["ent:kaminarimon", "ent:sensoji", "ent:asakusa"];
    const [ok] = checkNarrative(
      [{ text: "バードが書いたのは雷門ではなく観音でした。", claim_ids: ["cl:bird:kannon"], assertion_type: "direct" }],
      claims,
      nameIndex,
      subject,
    );
    expect(ok.ok).toBe(true);
    const [bad] = checkNarrative([{ text: "宝蔵門。", claim_ids: ["cl:bird:kannon"], assertion_type: "direct" }], claims, nameIndex, subject);
    expect(bad.problems).toContain("entity_not_in_claims:ent:hozomon");
  });

  it("does not count 浅草 inside 浅草寺 as a separate name", () => {
    const [s] = checkNarrative([{ text: "浅草寺の観音。", claim_ids: ["cl:bird:kannon"], assertion_type: "direct" }], claims, nameIndex);
    expect(s.ok).toBe(true);
  });

  it("rejects overstated absence (4.5.2), even in interpretive sentences", () => {
    for (const text of ["あなたが見上げる雷門は、門のない長い年月を越えて立つ。", "There was no gate when Bird came.", "a gateless century"]) {
      const [s] = checkNarrative([{ text, claim_ids: ["cl:exist:bird"], assertion_type: "interpretive" }], claims, nameIndex, ["ent:kaminarimon"]);
      expect(s.problems).toContain("overstated_absence");
    }
    const [ok] = checkNarrative(
      [{ text: "恒久的な雷門は焼失後まだ再建されていませんでした。", claim_ids: ["cl:exist:bird"], assertion_type: "derived" }],
      claims,
      nameIndex,
    );
    expect(ok.ok).toBe(true);
  });

  it("requires a derived claim for derived sentences", () => {
    const [s] = checkNarrative([{ text: "観音。", claim_ids: ["cl:bird:kannon"], assertion_type: "derived" }], claims, nameIndex);
    expect(s.problems).toContain("derived_without_derived_claim");
  });
});
