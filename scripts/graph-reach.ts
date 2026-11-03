/**
 * What the Evidence Graph can reach from a place (FR-59 basis): Evidence/Source nodes within 4 hops
 * of an entity, with one shortest path each.
 *   npx tsx --env-file=.env scripts/graph-reach.ts [ent:kaminarimon]
 */
import { driverFromEnv } from "./lib/neo4j";

const ent = process.argv[2] ?? "ent:kaminarimon";
const driver = driverFromEnv();
const s = driver.session({ defaultAccessMode: "READ" });
try {
  const r = await s.run(
    `MATCH (e:Entity {id: $ent})
     MATCH p = shortestPath((e)-[*..5]-(ev:Evidence))
     WHERE none(n IN nodes(p) WHERE n:Capture OR n:Thread OR n:NarrativeSentence)
     RETURN ev.id AS ev, [n IN nodes(p) | coalesce(n.id, '')] AS path, length(p) AS hops
     ORDER BY hops, ev LIMIT 80`,
    { ent },
  );
  for (const x of r.records) console.log(x.get("hops").toNumber(), x.get("ev"), x.get("path").join(" → "));
  console.log("total", r.records.length);
} finally {
  await s.close();
  await driver.close();
}
