import { describe, expect, it } from "vitest";
import { stageFacts } from "./how-facts";

const row = (stage: string, ms: number, cost: number, model = "claude-opus-5-5") => ({ stage, cost_usd: cost, record_json: JSON.stringify({ elapsedMs: ms, servedModel: model }) });

describe("/how: per-stage facts from the stored calls", () => {
  it("groups extract:* and narrate:*; median time and mean cost; models answered", () => {
    const f = stageFacts([row("extract:en", 2000, 0.01), row("extract:ja", 4000, 0.03), row("see", 5000, 0.05), row("narrate:ja", 3000, 0.02, "claude-sonnet-5-5")]);
    const ex = f.find((x) => x.stage === "extract")!;
    expect(ex).toMatchObject({ calls: 2, medianS: 3, models: ["claude-opus-5-5"] });
    expect(ex.meanCost).toBeCloseTo(0.02);
    expect(f.find((x) => x.stage === "narrate")?.models).toEqual(["claude-sonnet-5-5"]);
    expect(f[0].stage).toBe("extract"); // most calls first
  });
});
