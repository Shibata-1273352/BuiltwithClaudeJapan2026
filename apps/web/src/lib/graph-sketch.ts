/**
 * The Evidence Graph as drawn in 舞台裏 (6.5): exactly the nodes and relations this run wrote to
 * Neo4j (from buildGraphParams), reduced to a sketch, then laid out as a loom — columns
 * Source → Evidence → Claim → Time / Entity, ordered so the threads cross as little as possible.
 */
export type SketchKind = "source" | "evidence" | "claim" | "time" | "entity" | "conflict";
export type SketchNode = { id: string; kind: SketchKind; label: string; state?: string };
export type SketchEdge = { from: string; to: string; kind: "from_source" | "supports" | "contradicts" | "context" | "about" | "at_time" | "conflict" };
export type Sketch = { nodes: SketchNode[]; edges: SketchEdge[]; counts: Record<SketchKind, number> & { edges: number }; capped: boolean };

type Params = {
  capture: { target: string };
  sources: { id: string; title: string }[];
  evidence: { id: string; source: string }[];
  claims: { id: string; predicate: string; status: string }[];
  supports: { ev: string; claim: string; rel: string }[];
  times: { id: string; level: string; value: string }[];
  atTime: { claim: string; time: string }[];
  conflicts: { id: string; kind: string; claim: string }[];
};

const MAX_CLAIMS = 48;

export function graphSketch(p: Params): Sketch {
  const claims = p.claims.slice(0, MAX_CLAIMS);
  const keep = new Set(claims.map((c) => c.id));
  const sup = p.supports.filter((s) => keep.has(s.claim));
  const evIds = new Set(sup.map((s) => s.ev));
  const evidence = p.evidence.filter((e) => evIds.has(e.id));
  const srcIds = new Set(evidence.map((e) => e.source));
  const sources = p.sources.filter((s) => srcIds.has(s.id));
  const at = p.atTime.filter((a) => keep.has(a.claim));
  const times = p.times.filter((t) => at.some((a) => a.time === t.id));
  const conflicts = p.conflicts.filter((c) => keep.has(c.claim));
  const nodes: SketchNode[] = [
    ...sources.map((s) => ({ id: s.id, kind: "source" as const, label: s.title })),
    ...evidence.map((e) => ({ id: e.id, kind: "evidence" as const, label: "" })),
    ...claims.map((c) => ({ id: c.id, kind: "claim" as const, label: c.predicate, state: c.status })),
    ...times.map((t) => ({ id: t.id, kind: "time" as const, label: t.value })),
    { id: p.capture.target, kind: "entity" as const, label: p.capture.target },
    ...conflicts.map((c) => ({ id: c.id, kind: "conflict" as const, label: c.kind })),
  ];
  const have = new Set(nodes.map((n) => n.id));
  const edges: SketchEdge[] = [
    ...evidence.filter((e) => have.has(e.source)).map((e) => ({ from: e.source, to: e.id, kind: "from_source" as const })),
    ...sup.map((s) => ({ from: s.ev, to: s.claim, kind: (s.rel === "contradicts" ? "contradicts" : s.rel === "context_only" ? "context" : "supports") as SketchEdge["kind"] })),
    ...claims.map((c) => ({ from: c.id, to: p.capture.target, kind: "about" as const })),
    ...at.map((a) => ({ from: a.claim, to: a.time, kind: "at_time" as const })),
    ...conflicts.map((c) => ({ from: c.id, to: c.claim, kind: "conflict" as const })),
  ];
  const count = (k: SketchKind) => nodes.filter((n) => n.kind === k).length;
  return {
    nodes,
    edges,
    counts: { source: count("source"), evidence: count("evidence"), claim: count("claim"), time: count("time"), entity: count("entity"), conflict: count("conflict"), edges: edges.length },
    capped: p.claims.length > MAX_CLAIMS,
  };
}

const COLUMN: Record<SketchKind, number> = { source: 0, evidence: 1, claim: 2, conflict: 2, time: 3, entity: 3 };

/** Columns, each ordered by the mean position of its neighbours (a few sweeps both ways). */
export function loomLayout(s: Sketch, w: number, h: number, pad = 24): Map<string, { x: number; y: number }> {
  const cols: SketchNode[][] = [[], [], [], []];
  for (const n of s.nodes) cols[COLUMN[n.kind]].push(n);
  // time sorted by year above, the entity below
  cols[3].sort((a, b) => (a.kind === "entity" ? 1 : b.kind === "entity" ? -1 : a.label.localeCompare(b.label)));
  const nb = new Map<string, string[]>();
  for (const e of s.edges) {
    nb.set(e.from, [...(nb.get(e.from) ?? []), e.to]);
    nb.set(e.to, [...(nb.get(e.to) ?? []), e.from]);
  }
  const rank = new Map<string, number>();
  const assign = () => cols.forEach((c) => c.forEach((n, i) => rank.set(n.id, c.length > 1 ? i / (c.length - 1) : 0.5)));
  assign();
  const sweep = (order: number[]) => {
    for (const ci of order) {
      if (ci === 3) continue; // years keep their order
      const m = (n: SketchNode) => {
        const r = (nb.get(n.id) ?? []).map((x) => rank.get(x)).filter((v): v is number => v !== undefined);
        return r.length ? r.reduce((a, b) => a + b, 0) / r.length : (rank.get(n.id) ?? 0.5);
      };
      cols[ci].sort((a, b) => m(a) - m(b));
      assign();
    }
  };
  for (let i = 0; i < 4; i++) sweep(i % 2 ? [2, 1, 0] : [0, 1, 2]);
  const out = new Map<string, { x: number; y: number }>();
  cols.forEach((c, ci) => {
    const x = pad + (ci * (w - 2 * pad)) / 3;
    c.forEach((n, i) => out.set(n.id, { x, y: c.length > 1 ? pad + (i * (h - 2 * pad)) / (c.length - 1) : h / 2 }));
  });
  return out;
}
