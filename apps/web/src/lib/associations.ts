/**
 * FR-59 連想の糸: passages the Evidence Graph associates with this place that this run did not
 * retrieve — found by a personalized PageRank from the place over a bounded subgraph (4 hops,
 * ≤ 3000 paths), shown with the path that links them. Pencil: an association, not evidence.
 * Neo4j down or slow (2 s) → {ok:false}; the stage shows nothing.
 */
import type { DB } from "./corpus/db";
import { withReadTx } from "./neo4j";
import { personalizedPageRank, shortestPath, type Edge } from "./ppr";

/** Edge-type weights: structure and evidence links carry the walk; shared years only a little. */
export const EDGE_WEIGHT: Record<string, number> = {
  PART_OF: 1,
  DEDICATED_TO: 1,
  DEPICTS: 1,
  SUCCEEDS: 0.8,
  ABOUT: 1,
  SUPPORTS: 1,
  CONTEXT_FOR: 0.5,
  CONTRADICTS: 0.5,
  DEPENDS_ON: 0.5,
  FROM_SOURCE: 0.6,
  IN_CONFLICT: 0.3,
  AT_TIME: 0.25,
  IN_PERIOD: 0.15,
};

export type GraphNode = { id: string; label: string; name?: string | null; title?: string | null; value?: string | null };
export type Association = { passage: string; source: string; title: string; text: string; score: number; path: { id: string; label: string; text: string }[] };

/** "ev:bird-unbeaten:6:8:6+…" or "ev:passage:x:0:0" → the passage id "bird-unbeaten:6:8" / "x:0:0". */
export function passageOfEvidence(id: string): string | null {
  if (!id.startsWith("ev:")) return null;
  const first = id.slice(3).split("+")[0];
  if (first.startsWith("passage:")) return first.slice("passage:".length);
  const parts = first.split(":");
  return parts.length >= 4 ? parts.slice(0, 3).join(":") : parts.length === 3 ? first : null;
}

function nodeText(n: GraphNode | undefined, titleOf: (src: string) => string | undefined): string {
  if (!n) return "";
  if (n.label === "Entity") return n.name ?? n.id;
  if (n.label === "Source") return n.title ?? n.id;
  if (n.label === "Time") return String(n.value ?? n.id.replace(/^time:[a-z]:/, ""));
  if (n.label === "Evidence") {
    const p = passageOfEvidence(n.id);
    return p ? `${titleOf(p.split(":")[0]) ?? p.split(":")[0]} ${p.split(":").slice(1).join(":")}` : n.id;
  }
  if (n.label === "Claim") return "主張";
  return n.label;
}

/** Pure ranking step (tested without Neo4j). */
export function rankAssociations(
  edges: Edge[],
  nodes: Map<string, GraphNode>,
  seed: string,
  retrieved: Set<string>,
  titleOf: (src: string) => string | undefined,
  k = 3,
): Omit<Association, "text">[] {
  const { rank } = personalizedPageRank(edges, seed);
  const best = new Map<string, { ev: string; score: number }>();
  for (const [id, score] of rank) {
    if (nodes.get(id)?.label !== "Evidence") continue;
    const p = passageOfEvidence(id);
    if (!p || retrieved.has(p)) continue;
    if ((best.get(p)?.score ?? -1) < score) best.set(p, { ev: id, score });
  }
  // one passage per source first (variety), then the rest by score
  const sorted = [...best.entries()].sort((a, b) => b[1].score - a[1].score);
  const seen = new Set<string>();
  const firsts = sorted.filter(([p]) => !seen.has(p.split(":")[0]) && seen.add(p.split(":")[0]));
  const picked = [...firsts, ...sorted.filter((x) => !firsts.includes(x))].slice(0, k);
  return picked
    .map(([passage, { ev, score }]) => {
      const path = (shortestPath(edges, seed, ev) ?? [seed, ev]).map((id) => ({ id, label: nodes.get(id)?.label ?? "", text: nodeText(nodes.get(id), titleOf) }));
      const source = passage.split(":")[0];
      return { passage, source, title: titleOf(source) ?? source, score: Math.round(score * 1e4) / 1e4, path };
    });
}

const SUBGRAPH = `
MATCH (e:Entity {id: $seed})
CALL (e) {
  MATCH p = (e)-[*1..4]-(n)
  WHERE none(x IN nodes(p) WHERE x:Capture OR x:Thread OR x:NarrativeSentence OR x:NameUsage)
  RETURN p LIMIT 3000
}
UNWIND relationships(p) AS r
WITH DISTINCT r
RETURN startNode(r).id AS a, endNode(r).id AS b, type(r) AS t,
       labels(startNode(r))[0] AS la, labels(endNode(r))[0] AS lb,
       coalesce(startNode(r).name_ja, startNode(r).title) AS na, coalesce(endNode(r).name_ja, endNode(r).title) AS nb,
       toString(startNode(r).value) AS va, toString(endNode(r).value) AS vb`;

export async function findAssociations(seed: string, retrieved: Set<string>, corpus: DB, timeoutMs = 2000): Promise<{ ok: true; items: Association[]; ms: number } | { ok: false; reason: string }> {
  const t0 = Date.now();
  try {
    const rows = await Promise.race([
      withReadTx(async (tx) => (await tx.run(SUBGRAPH, { seed })).records.map((r) => r.toObject() as Record<string, string | null>)),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), timeoutMs)),
    ]);
    const nodes = new Map<string, GraphNode>();
    const edges: Edge[] = [];
    for (const r of rows) {
      nodes.set(r.a!, { id: r.a!, label: r.la!, name: r.la === "Entity" ? r.na : null, title: r.la === "Source" ? r.na : null, value: r.va });
      nodes.set(r.b!, { id: r.b!, label: r.lb!, name: r.lb === "Entity" ? r.nb : null, title: r.lb === "Source" ? r.nb : null, value: r.vb });
      edges.push({ a: r.a!, b: r.b!, w: EDGE_WEIGHT[r.t!] ?? 0.2 });
    }
    const titles = new Map((corpus.prepare("SELECT id, title FROM sources").all() as { id: string; title: string }[]).map((s) => [s.id, s.title]));
    const ranked = rankAssociations(edges, nodes, seed, retrieved, (s) => titles.get(s));
    const text = corpus.prepare("SELECT text FROM passages WHERE id = ?");
    const items = ranked.map((a) => ({ ...a, text: ((text.get(a.passage) as { text: string } | undefined)?.text ?? "").slice(0, 240) }));
    return { ok: true, items, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "error" };
  }
}
