import neo4j, { type Driver } from "neo4j-driver";

export function driverFromEnv(): Driver {
  const uri = process.env.NEO4J_URI ?? "bolt://127.0.0.1:7687";
  const user = process.env.NEO4J_USER ?? "neo4j";
  const password = process.env.NEO4J_PASSWORD;
  if (!password) throw new Error("NEO4J_PASSWORD is not set (.env)");
  return neo4j.driver(uri, neo4j.auth.basic(user, password));
}

/** Split a .cypher file into statements (drops // comments and blank lines). */
export function splitCypher(text: string): string[] {
  return text
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}
