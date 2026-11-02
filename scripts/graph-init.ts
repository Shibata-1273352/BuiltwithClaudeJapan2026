/**
 * Create constraints/indexes and seed the entity dictionary (corpus/entities.json) into Neo4j.
 *   npm run graph:init            # idempotent (MERGE)
 *   npm run graph:reset           # deletes ALL nodes in the local tsumugi DB first, then re-inits
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createHash } from "node:crypto";
import { EntityDictionary } from "@tsumugi/core";
import { driverFromEnv, splitCypher } from "./lib/neo4j";

const here = path.dirname(fileURLToPath(import.meta.url));
const infra = path.join(here, "..", "infra", "neo4j");
const dict = EntityDictionary.parse(JSON.parse(readFileSync(path.join(here, "..", "corpus", "entities.json"), "utf8")));
const reset = process.argv.includes("--reset");
const REL_TYPES = new Set(["DEDICATED_TO", "DEPICTS"]); // whitelist: relation types are not parameterizable in Cypher

const driver = driverFromEnv();
try {
  await driver.verifyConnectivity();
  const session = driver.session({ defaultAccessMode: "WRITE" });
  try {
    if (reset) {
      await session.run("MATCH (n) CALL (n) { DETACH DELETE n } IN TRANSACTIONS OF 1000 ROWS");
      console.log("reset: all nodes deleted");
    }
    const stmts = splitCypher(readFileSync(path.join(infra, "init.cypher"), "utf8"));
    for (const s of stmts) await session.run(s);
    console.log(`init.cypher: ${stmts.length} statements`);

    await session.executeWrite(async (tx) => {
      for (const e of dict.entities) {
        await tx.run(
          `MERGE (e:Entity {id: $id})
           SET e.type = $type, e.name_ja = $ja, e.name_en = $en, e.lat = $lat, e.lon = $lon, e.external_ids = $ext`,
          {
            id: e.id,
            type: e.type,
            ja: e.name.ja,
            en: e.name.en,
            lat: e.coords?.lat ?? null,
            lon: e.coords?.lon ?? null,
            ext: e.external_ids ? JSON.stringify(e.external_ids) : null,
          },
        );
        for (const u of e.names) {
          await tx.run(
            `MATCH (e:Entity {id: $eid})
             MERGE (n:NameUsage {id: $id})
             SET n.text = $text, n.lang = $lang, n.specificity = $spec, n.note = $note, n.source = 'dictionary'
             MERGE (n)-[:NAMES]->(e)`,
            {
              eid: e.id,
              // exact text, not normalized: "Nakamise" (unique) and "Naka-mise" (ambiguous) are different usages
              id: `nu:${e.id.slice(4)}:${u.lang}:${createHash("sha1").update(u.text).digest("hex").slice(0, 10)}`,
              text: u.text,
              lang: u.lang,
              spec: u.specificity,
              note: u.note ?? null,
            },
          );
        }
      }
      for (const e of dict.entities) {
        if (e.parent) await tx.run("MATCH (c:Entity {id: $c}), (p:Entity {id: $p}) MERGE (c)-[:PART_OF]->(p)", { c: e.id, p: e.parent });
      }
      for (const r of dict.relations) {
        if (!REL_TYPES.has(r.type)) throw new Error(`relation type not allowed: ${r.type}`);
        await tx.run(`MATCH (a:Entity {id: $a}), (b:Entity {id: $b}) MERGE (a)-[:${r.type}]->(b)`, { a: r.from, b: r.to });
      }
    });

    const c = await session.run("SHOW CONSTRAINTS YIELD name RETURN count(*) AS n");
    const e = await session.run("MATCH (n:Entity) RETURN count(n) AS n");
    const u = await session.run("MATCH (n:NameUsage) RETURN count(n) AS n");
    const r = await session.run("MATCH (:Entity)-[r]->(:Entity) RETURN count(r) AS n");
    console.log(
      `constraints=${c.records[0].get("n")} entities=${e.records[0].get("n")} name_usages=${u.records[0].get("n")} entity_rels=${r.records[0].get("n")}`,
    );
  } finally {
    await session.close();
  }
} finally {
  await driver.close();
}
