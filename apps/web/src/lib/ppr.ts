/**
 * Personalized PageRank (FR-59 連想の糸) on a small undirected weighted graph: a random walk that
 * restarts at the seed with probability α. Nodes the walk visits often are "associated" with the
 * seed. Pure and deterministic; power iteration to tolerance or a round limit.
 */
export type Edge = { a: string; b: string; w: number };

export function personalizedPageRank(edges: Edge[], seed: string, { alpha = 0.15, tol = 1e-6, maxIter = 50 } = {}): { rank: Map<string, number>; iterations: number } {
  const adj = new Map<string, { to: string; w: number }[]>();
  const add = (x: string, y: string, w: number) => {
    if (!adj.has(x)) adj.set(x, []);
    adj.get(x)!.push({ to: y, w });
  };
  for (const e of edges) {
    if (e.w <= 0 || e.a === e.b) continue;
    add(e.a, e.b, e.w);
    add(e.b, e.a, e.w);
  }
  if (!adj.has(seed)) return { rank: new Map([[seed, 1]]), iterations: 0 };
  const out = new Map<string, number>();
  for (const [k, list] of adj) out.set(k, list.reduce((s, x) => s + x.w, 0));
  let r = new Map<string, number>([[seed, 1]]);
  let it = 0;
  for (; it < maxIter; it++) {
    const next = new Map<string, number>([[seed, alpha]]);
    let dangling = 0;
    for (const [k, v] of r) {
      const list = adj.get(k);
      const tot = out.get(k) ?? 0;
      if (!list || tot === 0) {
        dangling += v;
        continue;
      }
      for (const x of list) next.set(x.to, (next.get(x.to) ?? 0) + ((1 - alpha) * v * x.w) / tot);
    }
    if (dangling) next.set(seed, (next.get(seed) ?? 0) + (1 - alpha) * dangling);
    let diff = 0;
    for (const k of new Set([...r.keys(), ...next.keys()])) diff += Math.abs((next.get(k) ?? 0) - (r.get(k) ?? 0));
    r = next;
    if (diff < tol) {
      it++;
      break;
    }
  }
  return { rank: r, iterations: it };
}

/** Shortest path (fewest hops) from seed to target, for showing why something is associated. */
export function shortestPath(edges: Edge[], seed: string, target: string): string[] | null {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    if (e.w <= 0) continue;
    (adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(e.b);
    (adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(e.a);
  }
  const prev = new Map<string, string | null>([[seed, null]]);
  const q = [seed];
  while (q.length) {
    const x = q.shift()!;
    if (x === target) break;
    for (const y of adj.get(x) ?? []) {
      if (prev.has(y)) continue;
      prev.set(y, x);
      q.push(y);
    }
  }
  if (!prev.has(target)) return null;
  const path: string[] = [];
  for (let c: string | null = target; c; c = prev.get(c) ?? null) path.unshift(c);
  return path;
}
