/**
 * Export the whole graph to JSON (pre-demo backup; Community Edition can't dump online).
 *   npm run graph:dump            -> $DATA_DIR/graph-dumps/graph-<timestamp>.json
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { driverFromEnv } from "./lib/neo4j";

const dataDir = process.env.DATA_DIR;
if (!dataDir) throw new Error("DATA_DIR is not set (.env)");

const driver = driverFromEnv();
try {
  const session = driver.session({ defaultAccessMode: "READ" });
  try {
    const nodes = await session.run(
      "MATCH (n) RETURN elementId(n) AS eid, labels(n) AS labels, properties(n) AS props",
    );
    const rels = await session.run(
      "MATCH (a)-[r]->(b) RETURN elementId(a) AS from, type(r) AS type, properties(r) AS props, elementId(b) AS to",
    );
    const out = {
      exportedAt: new Date().toISOString(),
      nodes: nodes.records.map((r) => r.toObject()),
      relationships: rels.records.map((r) => r.toObject()),
    };
    const dir = path.join(dataDir, "graph-dumps");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `graph-${out.exportedAt.replace(/[:.]/g, "-")}.json`);
    writeFileSync(file, JSON.stringify(out, null, 2));
    console.log(`${out.nodes.length} nodes, ${out.relationships.length} rels -> ${file}`);
  } finally {
    await session.close();
  }
} finally {
  await driver.close();
}
