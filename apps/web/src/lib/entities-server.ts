import { readFileSync } from "node:fs";
import path from "node:path";
import { Entities, EntityDictionary } from "@tsumugi/core";

let cached: Entities | undefined;

/** Entity dictionary from corpus/entities.json (repo root). Loaded once per server process. */
export function entities(): Entities {
  if (cached) return cached;
  const root = process.env.TSUMUGI_REPO_ROOT ?? path.resolve(process.cwd(), process.cwd().endsWith(path.join("apps", "web")) ? "../.." : ".");
  cached = new Entities(EntityDictionary.parse(JSON.parse(readFileSync(path.join(root, "corpus", "entities.json"), "utf8"))));
  return cached;
}
