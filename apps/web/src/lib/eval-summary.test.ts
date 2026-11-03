import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { evalSummary } from "./eval-summary";

// the stage shows latest.json; its numbers must be the ones the written report states
const md = (run: string) => readFileSync(path.join(import.meta.dirname, "../../../../evaluation/results", `${run}.md`), "utf8");

describe("eval summary (the figures of the latest evaluation report)", () => {
  const e = evalSummary();
  const report = md(e.run);
  it("time judgment: by the source's own time vs by publication date (code only)", () => {
    expect(e.existence.n).toBe(17);
    expect(e.existence.misbindWith).toBe(0);
    expect(report).toContain(`${Math.round(e.existence.withTime * 100)}% / ${e.existence.misbindWith}`);
    expect(report).toContain(`${Math.round(e.existence.byPublication * 100)}% / ${e.existence.misbindPublication}`);
  });
  it("citations, generation and the batch match the report", () => {
    expect(report).toContain(`exact match with the canonical text | ${Math.round(e.citation.exact * 100)}% (n=${e.citation.n})`);
    expect(report).toContain(`fabricated citations rejected | ${e.citation.rejected}/${e.citation.fabricated}`);
    expect(report).toContain(`${e.generation.caught} of ${e.generation.sentences}; shown: ${e.generation.shown}`);
    expect(report).toContain(`${e.batch.requests} requests`);
  });
});
