/**
 * The evaluation numbers for the stage (6.5, 2:40), computed from the stored result file — the same
 * figures as evaluation/results/<date>.md, never typed in by hand.
 */
import result from "../../../../evaluation/results/2026-11-03.json";

type Row = { expected: string; got: string; ablation_publication: string };
type Cit = { n: number; exact: number };

export function evalSummary() {
  const r = result as unknown as {
    run: string;
    cases: { annotated_by: string };
    existence: { rows: Row[] };
    citation: { fabricated: number; rejected_or_dropped: number };
    llm: { methods: Record<string, { Dplus: { citation: Cit } }>; generation: Record<string, { sentences: number; unsupported_detected: number; unsupported_shown: number }>; batch: { requests: number; cost_usd: number } };
    live: { latency_ms: { median: number; n: number }; cost_usd_mean: number; failure_rate: number };
  };
  const rows = r.existence.rows;
  const wrong = (got: (x: Row) => string) => rows.filter((x) => got(x) !== x.expected && got(x) !== "unknown").length;
  const cit = Object.values(r.llm.methods).map((m) => m.Dplus.citation);
  const citN = cit.reduce((a, c) => a + c.n, 0);
  const gen = Object.values(r.llm.generation);
  return {
    run: r.run,
    annotatedBy: r.cases.annotated_by,
    existence: {
      n: rows.length,
      withTime: rows.filter((x) => x.got === x.expected).length / rows.length,
      byPublication: rows.filter((x) => x.ablation_publication === x.expected).length / rows.length,
      misbindWith: wrong((x) => x.got),
      misbindPublication: wrong((x) => x.ablation_publication),
    },
    citation: { n: citN, exact: cit.reduce((a, c) => a + c.n * c.exact, 0) / Math.max(1, citN), fabricated: r.citation.fabricated, rejected: r.citation.rejected_or_dropped },
    generation: { sentences: gen.reduce((a, g) => a + g.sentences, 0), caught: gen.reduce((a, g) => a + g.unsupported_detected, 0), shown: gen.reduce((a, g) => a + g.unsupported_shown, 0) },
    batch: r.llm.batch,
    live: { medianS: r.live.latency_ms.median / 1000, n: r.live.latency_ms.n, cost: r.live.cost_usd_mean, failure: r.live.failure_rate },
  };
}
