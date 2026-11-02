/**
 * Neo4j access (REQUIREMENTS.md 4.4.8, ASI03).
 * Community Edition has no roles, so read/write separation is enforced here:
 * app code gets READ sessions; only the verified-result writer uses `withWriteTx`.
 * All Cypher is static and parameterized; Claude never writes query text (ASI02).
 */
import neo4j, { type Driver, type ManagedTransaction } from "neo4j-driver";

let driver: Driver | undefined;

function getDriver(): Driver {
  if (driver) return driver;
  const password = process.env.NEO4J_PASSWORD;
  if (!password) throw new Error("NEO4J_PASSWORD not set");
  driver = neo4j.driver(
    process.env.NEO4J_URI ?? "bolt://127.0.0.1:7687",
    neo4j.auth.basic(process.env.NEO4J_USER ?? "neo4j", password),
    { maxConnectionPoolSize: 20, connectionAcquisitionTimeout: 5_000 },
  );
  return driver;
}

export async function withReadTx<T>(work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });
  try {
    return await session.executeRead(work);
  } finally {
    await session.close();
  }
}

/** One capture's verified results are written in a single transaction (all-or-nothing). */
export async function withWriteTx<T>(work: (tx: ManagedTransaction) => Promise<T>): Promise<T> {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.WRITE });
  try {
    return await session.executeWrite(work);
  } finally {
    await session.close();
  }
}

export async function graphHealth(): Promise<{ ok: boolean; entities?: number }> {
  try {
    const n = await withReadTx(async (tx) => {
      const r = await tx.run("MATCH (e:Entity) RETURN count(e) AS n");
      return r.records[0].get("n").toNumber() as number;
    });
    return { ok: true, entities: n };
  } catch {
    return { ok: false };
  }
}
