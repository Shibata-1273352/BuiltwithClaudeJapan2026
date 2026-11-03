"use client";

/**
 * 舞台裏: the Evidence Graph this run wrote to Neo4j (6.5, 2:15), drawn as a loom — sources on the
 * left, their evidence, the claims it supports, then the years and the place. Hover a node to
 * light its threads. Every number is counted from the written sketch.
 */
import { useMemo, useState } from "react";
import { loomLayout, type Sketch, type SketchKind } from "@/lib/graph-sketch";
import { dict, useDict } from "../i18n";

const W = 880;
const H = 360;

const L = dict({
  ja: {
    title: "根拠グラフ（Neo4j に書いたもの）",
    cols: ["資料", "根拠（原文の文）", "主張", "時・場所"],
    counts: (s: Sketch["counts"]) => `資料 ${s.source} · 根拠 ${s.evidence} · 書いた主張 ${s.claim}（年表の主張を含む）· 年 ${s.time} · 関係 ${s.edges}`,
    capped: "主張が多いため、先頭の一部だけを描いています。",
    contra: "反証",
    context: "文脈のみ",
  },
  en: {
    title: "Evidence Graph (what was written to Neo4j)",
    cols: ["Sources", "Evidence (original sentences)", "Claims", "Time · place"],
    counts: (s: Sketch["counts"]) => `${s.source} sources · ${s.evidence} evidence · ${s.claim} claims written (incl. timeline claims) · ${s.time} years · ${s.edges} relations`,
    capped: "Many claims: only the first ones are drawn.",
    contra: "contradicts",
    context: "context only",
  },
});

const R: Record<SketchKind, number> = { source: 5, evidence: 2.4, claim: 3.2, time: 4, entity: 6, conflict: 4 };

export function GraphDiagram({ sketch }: { sketch: Sketch }) {
  const l = useDict(L);
  const pos = useMemo(() => loomLayout(sketch, W, H, 28), [sketch]);
  const [hot, setHot] = useState<string | null>(null);
  const lit = useMemo(() => {
    if (!hot) return null;
    // the node, its neighbours and their neighbours along the chain (source → evidence → claim → time)
    const on = new Set([hot]);
    for (let k = 0; k < 2; k++) for (const e of sketch.edges) if (on.has(e.from) || on.has(e.to)) [e.from, e.to].forEach((x) => on.add(x));
    return on;
  }, [hot, sketch]);
  return (
    <section className="mt-6 border-t border-rule pt-4" data-testid="graph-diagram" aria-label={l.title}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-caption font-bold text-lantern">{l.title}</h3>
        <span className="text-caption text-muted tabular-nums">{l.counts(sketch.counts)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H + 24}`} className="mt-2 w-full" role="img" aria-label={l.counts(sketch.counts)} onMouseLeave={() => setHot(null)}>
        {l.cols.map((c, i) => (
          <text key={c} x={28 + (i * (W - 56)) / 3} y={H + 18} textAnchor={i === 0 ? "start" : i === 3 ? "end" : "middle"} fontSize={11} fill="var(--muted)">
            {c}
          </text>
        ))}
        {sketch.edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const on = !lit || (lit.has(e.from) && lit.has(e.to));
          const mx = (a.x + b.x) / 2;
          const color = e.kind === "at_time" ? "var(--thread-toki)" : "var(--paper)";
          return (
            <path
              key={i}
              d={`M ${a.x} ${a.y} C ${mx} ${a.y} ${mx} ${b.y} ${b.x} ${b.y}`}
              fill="none"
              stroke={color}
              strokeOpacity={on ? (lit ? 0.85 : 0.22) : 0.04}
              strokeWidth={on && lit ? 1.2 : 0.7}
              strokeDasharray={e.kind === "context" ? "3 3" : e.kind === "contradicts" || e.kind === "conflict" ? "1 3" : undefined}
            />
          );
        })}
        {sketch.nodes.map((n) => {
          const p = pos.get(n.id)!;
          const on = !lit || lit.has(n.id);
          const fill = n.kind === "time" ? "var(--thread-toki)" : n.kind === "entity" ? "var(--lantern)" : n.kind === "conflict" ? "none" : "var(--paper)";
          return (
            <g key={n.id} onMouseEnter={() => setHot(n.id)} opacity={on ? 1 : 0.2} style={{ cursor: "default" }}>
              <circle cx={p.x} cy={p.y} r={R[n.kind] + 4} fill="transparent" />
              <circle cx={p.x} cy={p.y} r={R[n.kind]} fill={fill} stroke={n.kind === "conflict" ? "var(--paper)" : undefined} />
              {(n.kind === "source" || n.kind === "time") && (
                <text x={p.x + (n.kind === "source" ? 9 : -9)} y={p.y + 4} textAnchor={n.kind === "source" ? "start" : "end"} fontSize={11} fill="var(--paper)">
                  {n.label.length > 26 ? `${n.label.slice(0, 25)}…` : n.label}
                </text>
              )}
              <title>{n.label || n.id}</title>
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-caption text-muted">
        <span className="mr-4">— — {l.context}</span>
        <span>· · · {l.contra}</span>
        {sketch.capped && <span className="ml-4">{l.capped}</span>}
      </p>
    </section>
  );
}
