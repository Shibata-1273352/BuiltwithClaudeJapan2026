import { Entities, EntityDictionary } from "@tsumugi/core";
// Static import: the reviewed dictionary is part of the build (no runtime filesystem lookup).
import dictionary from "../../../../corpus/entities.json";

let cached: Entities | undefined;

/** Entity dictionary from corpus/entities.json. Validated once per server process. */
export function entities(): Entities {
  cached ??= new Entities(EntityDictionary.parse(dictionary));
  return cached;
}
