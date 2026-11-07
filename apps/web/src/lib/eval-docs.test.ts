import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { evalSummary } from "./eval-summary";

const root = join(__dirname, "..", "..", "..", "..");
const read = (file: string) => readFileSync(join(root, file), "utf8");
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The figures printed in the READMEs and docs must be the ones in the latest stored result. */
describe("evaluation figures in the docs", () => {
  const s = evalSummary();

  it("Japanese README", () => {
    const text = read("README.md");
    expect(text).toContain(`存在判定の正解率は${pct(s.existence.byPublication)}で、時代の取り違えが${s.existence.misbindPublication}件`);
    expect(text).toContain(`取り違えは${s.existence.misbindWith}件`);
    expect(text).toContain(`${s.citation.fabricated}件中${s.citation.rejected}件を拒否`);
  });

  it("English README", () => {
    const text = read("README.en.md");
    expect(text).toContain(`[\`evaluation/results/2026-11-04.md\`]`);
    expect(s.run.startsWith("2026-11-04")).toBe(true);
    expect(text).toContain(`${pct(s.existence.withTime)} / ${s.existence.misbindWith} | ${pct(s.existence.byPublication)} / ${s.existence.misbindPublication}`);
    expect(text).toContain(`(100%, n=${s.citation.n}`);
    expect(text).toContain(`${s.citation.rejected}/${s.citation.fabricated}`);
    expect(text).toContain(`caught by the checks ${s.generation.caught} of ${s.generation.sentences}`);
  });

  it("evaluation document", () => {
    const text = read("docs/evaluation.md");
    expect(text).toContain(`引用の原文一致 ${pct(s.citation.exact)}（n=${s.citation.n}）`);
    expect(text).toContain(`${pct(s.existence.withTime)} / ${s.existence.misbindWith} | ${pct(s.existence.byPublication)} / ${s.existence.misbindPublication}`);
  });
});
