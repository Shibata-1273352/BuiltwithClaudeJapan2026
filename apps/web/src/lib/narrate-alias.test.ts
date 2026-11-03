import { describe, expect, it } from "vitest";
import { entities } from "./entities-server";
import { buildNarrate } from "./narrate";

describe("narration cites short aliases, code checks the real ids", () => {
  const E = entities();
  const id = "cl:event:ex:kaminarimon:1866-destroyed";
  const cards = new Map([[id, { id, entities: ["ent:kaminarimon"], facts: "雷門 1866 焼失", derived: false, card: `${id} [ink] source "x": Kaminarimon — destroyed_in` }]]);
  const req = buildNarrate(E, cards, "ja");
  it("the prompt carries C1, not the long id", () => {
    expect(req.user).toContain("- C1 [ink]");
    expect(req.user).not.toContain(id);
  });
  it("C1 maps back to the claim and passes; an unknown alias is still unknown", () => {
    const out = req.finish(
      JSON.stringify({
        sentences: [
          { text: "雷門は1866年に焼失しました。", claim_ids: ["C1"], assertion_type: "direct" },
          { text: "雷門は焼けました。", claim_ids: ["C9"], assertion_type: "direct" },
        ],
      }),
      "end_turn",
    );
    expect(out[0].claim_ids).toEqual([id]);
    expect(out[0].ok).toBe(true);
    expect(out[1].problems).toContain("unknown_claim_id");
    expect(req.checkSome([{ text: "雷門は1866年に焼失しました。", claim_ids: ["C1"], assertion_type: "direct" }])[0].ok).toBe(true);
  });
});
