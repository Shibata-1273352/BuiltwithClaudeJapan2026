import { describe, expect, it } from "vitest";
import { checkClaim, displayState, type CheckContext, type ProposedClaim } from "./claims";

const sentences = new Map([
  ["bird:6:2:0", { passageId: "bird:6:2", lang: "en" as const, text: "ONCE for all I will describe a Buddhist temple, and it shall be the popular temple of Asakusa, which keeps fair and festival the whole year round, and is dedicated to the “thousand-armed” Kwan-non, the goddess of mercy." }],
  ["x:1:1:0", { passageId: "x:1:1", lang: "en" as const, text: "I heard of the Kaminari gate, but I did not go there." }],
  ["k:5:8:1", { passageId: "k:5:8", lang: "ja" as const, text: "浅草の観音堂について論ずれば雷門は既に焼失せてしまったが今なお残る二王門をば仲店の敷石道から望み見るが如き光景である。" }],
]);
const names: Record<string, string[]> = {
  "ent:sensoji": ["浅草寺", "Asakusa temple", "Kwan-non Temple", "観音堂"],
  "ent:kannon": ["Kwan-non", "観音"],
  "ent:kaminarimon": ["雷門", "Kaminari-mon", "Kaminari gate", "Thunder Gate"],
  "ent:asakusa": ["Asakusa", "浅草"],
};
const ctx: CheckContext = { sentences, entityIds: new Set(Object.keys(names)), namesOf: (id) => names[id] ?? [] };
const base = (over: Partial<ProposedClaim>): ProposedClaim => ({
  passage_id: "bird:6:2",
  sentence_ids: ["bird:6:2:0"],
  subject: "ent:sensoji",
  predicate: "describes",
  object: null,
  value: null,
  relation: "supports",
  negated: false,
  rationale: "",
  ...over,
});

describe("checkClaim (FR-13, FR-14, 4.4.7)", () => {
  it("accepts a grounded claim and cuts the excerpt from the canonical sentence", () => {
    const c = checkClaim(base({ subject: "ent:asakusa" }), ctx, 0);
    expect(c.status).toBe("accepted");
    expect(c.excerpt).toBe(sentences.get("bird:6:2:0")!.text);
  });

  it("accepts Kwan-non as a name of Kannon (RAG-01)", () => {
    const c = checkClaim(base({ subject: "ent:kannon", predicate: "named_as", value: "Kwan-non" }), ctx, 1);
    expect(c.status).toBe("accepted");
  });

  it("rejects a named_as whose value is not in the sentence", () => {
    expect(checkClaim(base({ subject: "ent:kannon", predicate: "named_as", value: "Kannon-sama" }), ctx, 2).status).toBe("rejected");
  });

  it("rejects invented sentence ids or ids from another passage", () => {
    expect(checkClaim(base({ sentence_ids: ["bird:6:2:99"] }), ctx, 3).status).toBe("rejected");
    expect(checkClaim(base({ sentence_ids: ["x:1:1:0"] }), ctx, 4).status).toBe("rejected");
  });

  it("rejects unknown entities", () => {
    expect(checkClaim(base({ subject: "ent:osaka-castle" }), ctx, 5).status).toBe("rejected");
  });

  it("never lets 'I did not go' support an observation (4.4.7 example)", () => {
    const c = checkClaim(
      base({ passage_id: "x:1:1", sentence_ids: ["x:1:1:0"], subject: "ent:kaminarimon", predicate: "observed", relation: "supports" }),
      ctx,
      6,
    );
    expect(c.relation).toBe("context_only");
    expect(c.status).toBe("downgraded");
  });

  it("downgrades describes→mentions when the subject is not named in the sentence", () => {
    const c = checkClaim(base({ subject: "ent:kaminarimon" }), ctx, 7);
    expect(c.predicate).toBe("mentions");
    expect(c.status).toBe("downgraded");
  });

  it("time consistency: Kafū (1914) cannot have observed Kaminarimon (absent then) — 4.4.7", () => {
    const withTime: CheckContext = { ...ctx, existenceAt: (e, p) => (e === "ent:kaminarimon" && p === "k:5:8" ? "absent" : "unknown") };
    const c = checkClaim(
      base({ passage_id: "k:5:8", sentence_ids: ["k:5:8:1"], subject: "ent:kaminarimon", predicate: "observed", relation: "supports" }),
      withTime,
      8,
    );
    expect(c.relation).toBe("context_only");
    expect(c.checks.find((x) => x.name === "time_consistent")?.ok).toBe(false);
    // …but saying it had burned is fine
    const ok = checkClaim(
      base({ passage_id: "k:5:8", sentence_ids: ["k:5:8:1"], subject: "ent:kaminarimon", predicate: "destroyed_in", relation: "supports" }),
      withTime,
      9,
    );
    expect(ok.status).toBe("accepted");
  });
});

describe("a writer only recorded as mentioning a place", () => {
  it("is downgraded from observed to mentions", () => {
    const seen = (saw: boolean | null) => checkClaim(base({ subject: "ent:kannon", predicate: "observed" }), { ...ctx, sawSubject: () => saw }, 0);
    expect(seen(false)).toMatchObject({ predicate: "mentions", status: "downgraded" });
    expect(seen(true).predicate).toBe("observed");
    expect(seen(null).predicate).toBe("observed");
  });
});

describe("displayState (4.6)", () => {
  it("ink only for direct + supports on the subject itself", () => {
    expect(displayState({ derivation: "direct", relations: ["supports"] })).toBe("ink");
    expect(displayState({ derivation: "direct", relations: ["supports"], aboutAncestorOnly: true })).toBe("pencil");
  });
  it("combined when derived with all dependencies, pending otherwise", () => {
    expect(displayState({ derivation: "derived", relations: ["supports"], allDependenciesPresent: true })).toBe("combined");
    expect(displayState({ derivation: "derived", relations: ["supports"], allDependenciesPresent: false })).toBe("pending");
  });
  it("absent / pending from existence, conflict wins, user confirmation wins", () => {
    expect(displayState({ derivation: "derived", relations: ["supports"], existence: "absent" })).toBe("absent");
    expect(displayState({ derivation: "derived", relations: ["supports"], existence: "unknown" })).toBe("pending");
    expect(displayState({ derivation: "direct", relations: ["supports", "contradicts"] })).toBe("conflict");
    expect(displayState({ derivation: "interpretive", relations: [], userConfirmed: true })).toBe("user_confirmed");
  });
});
