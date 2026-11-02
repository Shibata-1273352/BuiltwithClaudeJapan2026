/**
 * Invalidate a claim and everything built on it (REQUIREMENTS.md 4.4.8 影響範囲, ASI08, SEC-08):
 * dependent claims (DEPENDS_ON, transitively), the threads that show them and the narrative
 * sentences that cite them. Static, parameterized Cypher; one write transaction.
 */
import type { ManagedTransaction } from "neo4j-driver";
import { withReadTx, withWriteTx } from "./neo4j";

export type Impact = { claims: string[]; threads: string[]; sentences: string[] };

const IMPACT = `
  MATCH (root:Claim {id: $id})
  OPTIONAL MATCH (dep:Claim)-[:DEPENDS_ON*1..5]->(root)
  WITH root, collect(DISTINCT dep) AS deps
  WITH [root] + deps AS affected
  UNWIND affected AS c
  OPTIONAL MATCH (t:Thread)-[:SHOWS]->(c)
  OPTIONAL MATCH (s:NarrativeSentence)-[:CITES]->(c)
  RETURN collect(DISTINCT c.id) AS claims, collect(DISTINCT t.id) AS threads, collect(DISTINCT s.id) AS sentences`;

export async function impactOf(claimId: string): Promise<Impact> {
  return withReadTx(async (tx) => {
    const r = await tx.run(IMPACT, { id: claimId });
    const rec = r.records[0];
    return rec
      ? { claims: rec.get("claims"), threads: rec.get("threads").filter(Boolean), sentences: rec.get("sentences").filter(Boolean) }
      : { claims: [], threads: [], sentences: [] };
  });
}

export async function invalidateClaim(claimId: string, reason: string): Promise<Impact> {
  const impact = await impactOf(claimId);
  if (!impact.claims.length) return impact;
  await withWriteTx(async (tx: ManagedTransaction) => {
    await tx.run(`UNWIND $ids AS id MATCH (c:Claim {id: id}) SET c.status = 'invalidated', c.invalidated_reason = $reason, c.invalidated_at = datetime()`, {
      ids: impact.claims,
      reason,
    });
    await tx.run(`UNWIND $ids AS id MATCH (t:Thread {id: id}) SET t.state = 'invalidated'`, { ids: impact.threads });
    await tx.run(`UNWIND $ids AS id MATCH (s:NarrativeSentence {id: id}) SET s.invalid = true`, { ids: impact.sentences });
  });
  return impact;
}
