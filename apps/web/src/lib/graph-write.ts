/**
 * Save one capture's verified results to the Evidence Graph in ONE write transaction
 * (REQUIREMENTS.md 4.4.8). All Cypher is static and parameterized; MERGE keeps it idempotent.
 * Evidence nodes do not copy text: they reference SQLite sentence ids and the source version hash.
 */
import { timeKeys, toRange, type CheckedClaim, type Entities } from "@tsumugi/core";
import type { ManagedTransaction } from "neo4j-driver";
import type { ExistenceRow, Thread } from "./dag/threads";
import { withWriteTx } from "./neo4j";
import { timeline } from "./timeline-server";

export type GraphInput = {
  captureId: string;
  target: string;
  claims: (CheckedClaim & { sourceId: string; sourceVersion?: string })[];
  existence: ExistenceRow[];
  threads: Thread[];
  narrative: { text: string; claim_ids: string[]; assertion_type: string; lang: string }[];
  sources: { id: string; type: string; title: string; version: string }[];
};

type TimeNode = { id: string; level: "year" | "decade" | "era"; value: string };

function timeNodes(iso: string): { nodes: TimeNode[]; yearId: string; links: [string, string][] } {
  const k = timeKeys(iso);
  const y = { id: `time:y:${k.year}`, level: "year" as const, value: String(k.year) };
  const d = { id: `time:d:${k.decade}`, level: "decade" as const, value: k.decade };
  const e = { id: `time:e:${k.era}`, level: "era" as const, value: k.era };
  return { nodes: [y, d, e], yearId: y.id, links: [[y.id, d.id], [y.id, e.id]] };
}

export function buildGraphParams(E: Entities, g: GraphInput) {
  const tl = timeline().t;
  const evidence = new Map<string, { id: string; source: string; sentences: string[]; version: string | null }>();
  const supports: { ev: string; claim: string; rel: string; review: string }[] = [];
  const claims: { id: string; subject: string; object: string | null; predicate: string; value: string | null; derivation: string; status: string }[] = [];
  const times = new Map<string, TimeNode>();
  const timeLinks: [string, string][] = [];
  const atTime: { claim: string; time: string; from: string; to: string }[] = [];
  const dependsOn: { from: string; to: string }[] = [];

  for (const c of g.claims.filter((x) => x.status !== "rejected")) {
    const evId = `ev:${c.sentence_ids.join("+")}`;
    evidence.set(evId, { id: evId, source: c.sourceId, sentences: c.sentence_ids, version: c.sourceVersion ?? null });
    claims.push({ id: c.id, subject: c.subject, object: c.object, predicate: c.predicate, value: c.value, derivation: "direct", status: c.status });
    supports.push({ ev: evId, claim: c.id, rel: c.relation, review: c.checks.every((k) => k.ok) ? "rule_checked" : "model_assessed" });
  }

  // Existence events become claims backed by their evidence; derived existence claims depend on them.
  const events = tl.existence_events.filter((e) => e.entity === g.target);
  for (const e of events) {
    const cid = `cl:event:${e.id}`;
    claims.push({ id: cid, subject: e.entity, object: null, predicate: `${e.event}_in`, value: e.original ?? null, derivation: "direct", status: "accepted" });
    for (const pid of e.evidence) {
      const evId = `ev:passage:${pid}`;
      evidence.set(evId, { id: evId, source: pid.split(":")[0], sentences: [], version: null });
      supports.push({ ev: evId, claim: cid, rel: "supports", review: tl.reviewed_by ? "human_reviewed" : "unreviewed" });
    }
    const t = timeNodes(e.time.start);
    t.nodes.forEach((n) => times.set(n.id, n));
    timeLinks.push(...t.links);
    atTime.push({ claim: cid, time: t.yearId, from: e.time.start, to: e.time.end });
  }
  for (const r of g.existence) {
    const cid = `cl:exist:${g.target}:${r.source}`;
    claims.push({ id: cid, subject: g.target, object: null, predicate: `existence_${r.value}`, value: r.reason, derivation: "derived", status: "accepted" });
    for (const from of [...(r.period?.from ?? []), ...(r.period?.to ?? [])]) dependsOn.push({ from: cid, to: `cl:event:${from}` });
    for (const pid of r.timeEvidence) {
      const evId = `ev:passage:${pid}`;
      evidence.set(evId, { id: evId, source: r.source, sentences: [], version: null });
      supports.push({ ev: evId, claim: cid, rel: "context_only", review: "rule_checked" });
    }
    const range = r.time ? toRange({ precision: r.time.end ? "range" : "day", start: r.time.start, end: r.time.end ?? null }) : null;
    if (range) {
      const t = timeNodes(range.start);
      t.nodes.forEach((n) => times.set(n.id, n));
      timeLinks.push(...t.links);
      atTime.push({ claim: cid, time: t.yearId, from: range.start, to: range.end });
    }
  }

  const conflicts = tl.conflicts
    .filter((c) => events.some((e) => e.id === c.about))
    .map((c) => ({ id: c.id, kind: c.kind, ja: c.explanation.ja, en: c.explanation.en, claim: `cl:event:${c.about}` }));

  return {
    capture: { id: g.captureId, target: g.target },
    sources: g.sources,
    evidence: [...evidence.values()],
    claims,
    supports,
    times: [...times.values()],
    timeLinks: [...new Set(timeLinks.map((l) => l.join("|")))].map((s) => s.split("|")),
    atTime,
    dependsOn,
    conflicts,
    threads: g.threads.map((t) => ({ id: `${t.id}@${g.captureId}`, claim: t.claimId, layer: t.layer, state: t.state, ja: t.label.ja, en: t.label.en })),
    sentences: g.narrative.map((s, i) => ({ id: `ns:${g.captureId}:${s.lang}:${i}`, text: s.text, lang: s.lang, type: s.assertion_type, claims: s.claim_ids })),
    knownEntities: E.dict.entities.map((e) => e.id),
  };
}

const CYPHER = [
  `MERGE (c:Capture {id: $capture.id}) SET c.created_at = datetime()
   WITH c MATCH (e:Entity {id: $capture.target}) MERGE (c)-[:STARTED_FROM]->(e)`,
  `UNWIND $sources AS s MERGE (n:Source {id: s.id}) SET n.type = s.type, n.title = s.title, n.version_hash = s.version`,
  `UNWIND $evidence AS ev MERGE (n:Evidence {id: ev.id}) SET n.sentence_ids = ev.sentences, n.source_version_hash = ev.version
   WITH n, ev MATCH (s:Source {id: ev.source}) MERGE (n)-[:FROM_SOURCE]->(s)`,
  `UNWIND $claims AS cl MERGE (n:Claim {id: cl.id})
   SET n.predicate = cl.predicate, n.value = cl.value, n.derivation = cl.derivation, n.status = cl.status
   WITH n, cl MATCH (e:Entity {id: cl.subject}) MERGE (n)-[:ABOUT]->(e)`,
  `UNWIND [x IN $claims WHERE x.object IS NOT NULL AND x.object IN $knownEntities] AS cl
   MATCH (n:Claim {id: cl.id}), (o:Entity {id: cl.object}) MERGE (n)-[:ABOUT {role: 'object'}]->(o)`,
  `UNWIND [x IN $supports WHERE x.rel = 'supports'] AS r MATCH (e:Evidence {id: r.ev}), (c:Claim {id: r.claim}) MERGE (e)-[x:SUPPORTS]->(c) SET x.review = r.review`,
  `UNWIND [x IN $supports WHERE x.rel = 'contradicts'] AS r MATCH (e:Evidence {id: r.ev}), (c:Claim {id: r.claim}) MERGE (e)-[x:CONTRADICTS]->(c) SET x.review = r.review`,
  `UNWIND [x IN $supports WHERE x.rel = 'context_only'] AS r MATCH (e:Evidence {id: r.ev}), (c:Claim {id: r.claim}) MERGE (e)-[x:CONTEXT_FOR]->(c) SET x.review = r.review`,
  `UNWIND $times AS t MERGE (n:Time {id: t.id}) SET n.level = t.level, n.value = t.value`,
  `UNWIND $timeLinks AS l MATCH (a:Time {id: l[0]}), (b:Time {id: l[1]}) MERGE (a)-[:IN_PERIOD]->(b)`,
  `UNWIND $atTime AS a MATCH (c:Claim {id: a.claim}), (t:Time {id: a.time}) MERGE (c)-[x:AT_TIME]->(t) SET x.valid_from = date(a.from), x.valid_to = date(a.to)`,
  `UNWIND $dependsOn AS d MATCH (a:Claim {id: d.from}), (b:Claim {id: d.to}) MERGE (a)-[:DEPENDS_ON]->(b)`,
  `UNWIND $conflicts AS cf MERGE (n:Conflict {id: cf.id}) SET n.kind = cf.kind, n.explanation_ja = cf.ja, n.explanation_en = cf.en
   WITH n, cf MATCH (c:Claim {id: cf.claim}) MERGE (n)-[:IN_CONFLICT]->(c)`,
  `UNWIND $threads AS t MERGE (n:Thread {id: t.id}) SET n.layer = t.layer, n.state = t.state, n.label_ja = t.ja, n.label_en = t.en
   WITH n, t MATCH (c:Claim {id: t.claim}) MERGE (n)-[:SHOWS]->(c)`,
  `UNWIND $sentences AS s MERGE (n:NarrativeSentence {id: s.id}) SET n.text = s.text, n.lang = s.lang, n.assertion_type = s.type
   WITH n, s UNWIND s.claims AS cid MATCH (c:Claim {id: cid}) MERGE (n)-[:CITES]->(c)`,
];

export async function saveToGraph(E: Entities, g: GraphInput): Promise<{ ok: true; ms: number } | { ok: false; error: string }> {
  const params = buildGraphParams(E, g);
  const t0 = Date.now();
  try {
    await withWriteTx(async (tx: ManagedTransaction) => {
      for (const q of CYPHER) await tx.run(q, params);
    });
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, error: String((e as Error).message).slice(0, 200) };
  }
}
