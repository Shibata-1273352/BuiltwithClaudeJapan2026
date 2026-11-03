/**
 * Completed items of a JSON array that is still being written (streamed structured output).
 * `completedArrayItems('{"elements":[{"a":1},{"b"', "elements")` → [{a:1}]. Only objects whose
 * closing brace has arrived are returned; strings and escapes are respected. Pure, no throw.
 */
export function completedArrayItems(partial: string, key: string): unknown[] {
  const m = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(partial);
  if (!m) return [];
  const out: unknown[] = [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let start = -1;
  for (let i = m.index + m[0].length; i < partial.length; i++) {
    const c = partial[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{" || c === "[") {
      if (depth === 0 && c === "{") start = i;
      depth++;
    } else if (c === "}" || c === "]") {
      if (depth === 0) break; // the array itself closed
      depth--;
      if (depth === 0 && start >= 0) {
        try {
          out.push(JSON.parse(partial.slice(start, i + 1)));
        } catch {
          /* not an object after all */
        }
        start = -1;
      }
    }
  }
  return out;
}
