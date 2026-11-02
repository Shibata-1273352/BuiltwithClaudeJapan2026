/**
 * Inspect the Evidence Graph: label counts and the impact of invalidating one claim (SEC-08 basis).
 *   npm run graph:inspect -- [claimId]
 */
import { driverFromEnv } from "./lib/neo4j";

const claimId = process.argv[2] ?? "cl:event:ex:kaminarimon:1866-destroyed";
const driver = driverFromEnv();
const s = driver.session({ defaultAccessMode: "READ" });
try {
  const counts = await s.run("MATCH (n) UNWIND labels(n) AS l RETURN l AS label, count(*) AS n ORDER BY label");
  console.log(Object.fromEntries(counts.records.map((r) => [r.get("label"), r.get("n").toNumber()])));
  const rels = await s.run("MATCH ()-[r]->() RETURN type(r) AS t, count(*) AS n ORDER BY t");
  console.log(Object.fromEntries(rels.records.map((r) => [r.get("t"), r.get("n").toNumber()])));

  // Impact: claims that depend (transitively) on this claim, and the threads / narrative sentences built on them.
  const impact = await s.run(
    `MATCH (root:Claim {id: $id})
     OPTIONAL MATCH (dep:Claim)-[:DEPENDS_ON*1..3]->(root)
     WITH root, collect(DISTINCT dep) AS deps
     WITH [root] + deps AS affected
     UNWIND affected AS c
     OPTIONAL MATCH (t:Thread)-[:SHOWS]->(c)
     OPTIONAL MATCH (ns:NarrativeSentence)-[:CITES]->(c)
     RETURN collect(DISTINCT c.id) AS claims, collect(DISTINCT t.label_ja) AS threads, collect(DISTINCT ns.text) AS sentences`,
    { id: claimId },
  );
  const r = impact.records[0];
  console.log(`\nImpact of invalidating ${claimId}:`);
  console.log("claims:", r.get("claims"));
  console.log("threads:", r.get("threads"));
  console.log("narrative sentences:", r.get("sentences"));

  // Time slider basis (FR-55/56): claims valid in the 1870s
  const t = await s.run(
    `MATCH (c:Claim)-[x:AT_TIME]->(:Time)-[:IN_PERIOD]->(d:Time {level: 'decade', value: $decade})
     RETURN c.id AS id, c.predicate AS p, toString(x.valid_from) AS f, toString(x.valid_to) AS t ORDER BY f`,
    { decade: "1870s" },
  );
  console.log("\nClaims in the 1870s:", t.records.map((x) => `${x.get("id")} ${x.get("p")} ${x.get("f")}..${x.get("t")}`));
} finally {
  await s.close();
  await driver.close();
}
