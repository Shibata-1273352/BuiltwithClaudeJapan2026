/**
 * Create constraints/indexes and the minimal seed in Neo4j.
 *   npm run graph:init            # idempotent
 *   npm run graph:reset           # deletes ALL nodes in the local tsumugi DB first, then re-inits
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { driverFromEnv, splitCypher } from "./lib/neo4j";

const here = path.dirname(fileURLToPath(import.meta.url));
const infra = path.join(here, "..", "infra", "neo4j");
const reset = process.argv.includes("--reset");

const driver = driverFromEnv();
try {
  await driver.verifyConnectivity();
  const session = driver.session({ defaultAccessMode: "WRITE" });
  try {
    if (reset) {
      await session.run("MATCH (n) CALL (n) { DETACH DELETE n } IN TRANSACTIONS OF 1000 ROWS");
      console.log("reset: all nodes deleted");
    }
    for (const file of ["init.cypher", "seed.cypher"]) {
      const stmts = splitCypher(readFileSync(path.join(infra, file), "utf8"));
      for (const s of stmts) await session.run(s);
      console.log(`${file}: ${stmts.length} statements`);
    }
    const c = await session.run("SHOW CONSTRAINTS YIELD name RETURN count(*) AS n");
    const e = await session.run("MATCH (n:Entity) RETURN count(n) AS n");
    const r = await session.run("MATCH (:Entity)-[r]->(:Entity) RETURN count(r) AS n");
    console.log(
      `constraints=${c.records[0].get("n")} entities=${e.records[0].get("n")} entity_rels=${r.records[0].get("n")}`,
    );
  } finally {
    await session.close();
  }
} finally {
  await driver.close();
}
