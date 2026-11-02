/** Markdown tables for the evaluation result (README, 10.2 / 10.3). */
/* eslint-disable @typescript-eslint/no-explicit-any */

const pct = (x: number | undefined | null) => (x === undefined || x === null || Number.isNaN(x) ? "–" : `${Math.round(x * 100)}%`);
const num = (x: number | undefined | null, d = 2) => (x === undefined || x === null || Number.isNaN(x) ? "–" : x.toFixed(d));
const mean = (xs: number[]) => {
  const v = xs.filter((x) => !Number.isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};
/** pooled rate over targets: sum of numerators / sum of n */
const pooled = (rows: { n: number; rate: number }[]) => {
  const n = rows.reduce((a, r) => a + (Number.isNaN(r.rate) ? 0 : r.n), 0);
  return n ? rows.reduce((a, r) => a + (Number.isNaN(r.rate) ? 0 : r.rate * r.n), 0) / n : NaN;
};

export function report(r: any): string {
  const T = Object.keys(r.perTarget);
  const ret = (k: string, lang: string) => mean(T.map((t) => r.perTarget[t].retrieval[lang][k]));
  const L: string[] = [];
  L.push(`# Evaluation ${r.run}`, "");
  L.push(
    `Model ${r.model}. Cases v${r.cases.version} (${r.cases.hash}, frozen ${r.cases.frozen_at}, annotated by ${r.cases.annotated_by}). ` +
      `Targets: ${T.join(", ")}. A limited, hand-made evaluation set: it checks citation agreement and mis-bindings of entity and era; it does not prove a zero hallucination rate.`,
    "",
  );

  // methods
  const m = r.llm?.methods;
  const ident = (k: string) => (m ? pooled(T.map((t) => ({ n: m[t][k].identification.n, rate: m[t][k].identification.precision }))) : NaN);
  const rel = (k: string) => (m ? pooled(T.map((t) => ({ n: m[t][k].relation.n, rate: m[t][k].relation.precision }))) : NaN);
  const sup = (k: string) => (m ? pooled(T.map((t) => ({ n: m[t][k].support_proxy.n, rate: m[t][k].support_proxy.rate }))) : NaN);
  const nOf = (k: string, f: string) => (m ? T.reduce((a, t) => a + m[t][k][f].n, 0) : 0);
  L.push("## Methods (4.9, RAG-09)", "");
  L.push("| Method | Recall@10 en | Recall@10 ja | MRR en | MRR ja | Entity identification precision | Relation precision (observed ≠ mentions) | Support (proxy) |");
  L.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
  L.push(`| A full-text only | ${pct(ret("A_recall10", "en"))} | ${pct(ret("A_recall10", "ja"))} | ${num(ret("A_mrr", "en"))} | ${num(ret("A_mrr", "ja"))} | – | – | – |`);
  const bIdent = pooled(T.map((t) => ({ n: r.perTarget[t].B_items.identification.n, rate: r.perTarget[t].B_items.identification.precision })));
  L.push(`| B names + relation co-occurrence + RRF (no vector channel) | ${pct(ret("B_recall10", "en"))} | ${pct(ret("B_recall10", "ja"))} | ${num(ret("B_mrr", "en"))} | ${num(ret("B_mrr", "ja"))} | ${pct(bIdent)} (matched entity) | – | – |`);
  if (m) {
    const cr = (lang: string) => mean(T.map((t) => m[t].C.recall10[lang]));
    L.push(`| C B + Claude selection (no code checks) | ${pct(cr("en"))} | ${pct(cr("ja"))} | – | – | ${pct(ident("C"))} (n=${nOf("C", "identification")}) | ${pct(rel("C"))} (n=${nOf("C", "relation")}) | ${pct(sup("C"))} |`);
    L.push(`| D B + Claim/Evidence checked by code | same as B | same as B | | | ${pct(ident("D"))} (n=${nOf("D", "identification")}) | ${pct(rel("D"))} (n=${nOf("D", "relation")}) | ${pct(sup("D"))} |`);
    const dr = (lang: string) => mean(T.map((t) => m[t].Dplus.recall_all[lang]));
    L.push(`| D+ D + gap round (adopted) | candidates: ${pct(dr("en"))} | candidates: ${pct(dr("ja"))} | | | ${pct(ident("Dplus"))} (n=${nOf("Dplus", "identification")}) | ${pct(rel("Dplus"))} (n=${nOf("Dplus", "relation")}) | ${pct(sup("Dplus"))} |`);
  } else L.push("| C / D / D+ | not run (--no-llm) | | | | | | |");
  L.push("");
  L.push(
    "- Entity identification precision: of the items said to be about the photo's structure, the share whose passage actually names it (the 'Kwan-non = 雷門' error). " +
      "Relation precision: of observed / describes / named_as items, the share that is not a listed forbidden claim (10.1 誤). " +
      "Support (proxy): share of items whose passage is in the gold set — a proxy, not a human judgment of support.",
  );
  if (m) {
    const raw = (k: string) => pooled(T.map((t) => ({ n: m[t][k].proposed_unchecked.relation.n, rate: m[t][k].proposed_unchecked.relation.precision })));
    const rawI = (k: string) => pooled(T.map((t) => ({ n: m[t][k].proposed_unchecked.identification.n, rate: m[t][k].proposed_unchecked.identification.precision })));
    L.push(`- Claude's raw proposals in D before the code checks: identification ${pct(rawI("D"))}, relation ${pct(raw("D"))}. The checks are what move these to the D row.`);
    const st = T.map((t) => m[t].Dplus.status);
    L.push(`- D+ claims: accepted ${st.reduce((a, s) => a + s.accepted, 0)}, downgraded ${st.reduce((a, s) => a + s.downgraded, 0)}, rejected ${st.reduce((a, s) => a + s.rejected, 0)}.`);
  }
  L.push("");

  // ablations
  L.push("## Ablations (10.3, RAG-12)", "");
  L.push("| Comparison | Removed | Metric | With | Without |", "| --- | --- | --- | --- | --- |");
  L.push(`| Context headers | index without headers | Recall@10 en / ja | ${pct(ret("B_recall10", "en"))} / ${pct(ret("B_recall10", "ja"))} | ${pct(ret("Bnohdr_recall10", "en"))} / ${pct(ret("Bnohdr_recall10", "ja"))} |`);
  L.push(`| | | MRR en / ja | ${num(ret("B_mrr", "en"))} / ${num(ret("B_mrr", "ja"))} | ${num(ret("Bnohdr_mrr", "en"))} / ${num(ret("Bnohdr_mrr", "ja"))} |`);
  if (m) {
    L.push(`| Relation context | passage only to Claude | identification / support (proxy) | ${pct(ident("D"))} / ${pct(sup("D"))} | ${pct(ident("D_noRel"))} / ${pct(sup("D_noRel"))} |`);
    const dr = (lang: string) => mean(T.map((t) => m[t].Dplus.recall_all[lang]));
    L.push(`| Gap round | stop after round 1 (D) | candidate recall en / ja | ${pct(dr("en"))} / ${pct(dr("ja"))} | ${pct(ret("B_recall_all", "en"))} / ${pct(ret("B_recall_all", "ja"))} |`);
  }
  const a = r.existence.ablation_time;
  L.push(`| Time range | judge by publication date | existence accuracy / era mis-bindings | ${pct(a.accuracy_with)} / ${a.era_misbindings_with} | ${pct(a.accuracy_publication)} / ${a.era_misbindings_publication} |`);
  L.push("| Visual search (P1) | text only | artwork Recall@5 | n/a | n/a |", "");

  // other rows of 10.2
  L.push("## Other metrics (10.2)", "");
  L.push("| Layer | Metric | Result |", "| --- | --- | --- |");
  L.push(
    `| Time | existence judgment accuracy | ${pct(r.existence.accuracy_all)} (n=${r.existence.n}; human-approved Kaminarimon ${pct(r.existence.accuracy_approved)}, pending sites ${pct(r.existence.accuracy_pending)}) |`,
  );
  L.push(`| Hold | holds where the gold says hold | ${pct(r.existence.hold_rate)} (n=${r.existence.n_hold}) |`);
  const c = r.citation;
  const ex = m ? T.map((t) => m[t].Dplus.citation) : [];
  L.push(
    `| Citation | exact match with the canonical text | ${m ? pct(pooled(ex.map((e: any) => ({ n: e.n, rate: e.exact })))) + ` (n=${ex.reduce((s: number, e: any) => s + e.n, 0)})` : "–"} |`,
  );
  L.push(`| Citation | fabricated citations rejected | ${c.rejected_or_dropped}/${c.fabricated} (valid control accepted: ${c.valid_accepted ? "yes" : "no"}) |`);
  if (r.llm?.generation) {
    const g = T.map((t) => r.llm.generation[t]);
    L.push(
      `| Generation | unsupported fact sentences | written by Claude and caught by the checks: ${g.reduce((s: number, x: any) => s + x.unsupported_detected, 0)} of ${g.reduce((s: number, x: any) => s + x.sentences, 0)}; shown: 0 |`,
    );
  }
  L.push(`| Invariance | IDs and states unchanged after language switch (RAG-08) | ${r.live.rag08.consistent}/${r.live.rag08.explorations} live explorations |`);
  L.push(
    `| Execution | latency / cost / failure (live runs since 2026-11-02) | median ${num(r.live.latency_ms.median / 1000, 1)} s, p90 ${num(r.live.latency_ms.p90 / 1000, 1)} s (n=${r.live.latency_ms.n}); $${num(r.live.cost_usd_mean, 3)} per exploration; failure ${pct(r.live.failure_rate)} of ${r.live.explorations} |`,
  );
  if (r.llm?.batch) L.push(`| Evaluation run | Batch API | ${r.llm.batch.requests} requests, ${r.llm.batch.failed} failed, $${num(r.llm.batch.cost_usd, 3)} |`);
  L.push("");
  return L.join("\n") + "\n";
}
