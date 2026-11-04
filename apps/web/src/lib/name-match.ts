/**
 * Does the name read in the photo stand in the record? A comparison of characters, done by code: it
 * says the words are the same, not that they mean the same person. Pure.
 */

const JA_MIN = 4; // shorter runs are common words, not names

/** Every maximal run of at least `min` characters that `text` shares with `from`. */
function sharedRuns(from: string, text: string, min: number): string[] {
  const found = new Set<string>();
  for (let i = 0; i < text.length; i++) {
    let best = 0;
    for (let j = 0; j < from.length; j++) {
      let k = 0;
      while (i + k < text.length && j + k < from.length && text[i + k] === from[j + k]) k++;
      best = Math.max(best, k);
    }
    if (best >= min) {
      found.add(text.slice(i, i + best));
      i += best - 1;
    }
  }
  return [...found];
}

const plain = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** The readings of the photo found word for word in a Japanese line. */
export function sharedJa(readings: string[], line: string): string[] {
  return [...new Set(readings.flatMap((r) => r.split(/\s+/).flatMap((part) => sharedRuns(part, line, JA_MIN))))];
}

/** The romanised readings found in an English line, whole words, two at least, macrons ignored. */
export function sharedEn(readings: string[], line: string): string[] {
  const words = [...line.matchAll(/[\p{L}]+/gu)];
  const out = new Set<string>();
  for (const reading of readings) {
    const want = plain(reading).split(/[^\p{L}]+/u).filter(Boolean);
    for (let i = 0; i < words.length; i++) {
      for (let j = 0; j < want.length; j++) {
        let k = 0;
        while (i + k < words.length && j + k < want.length && plain(words[i + k][0]) === want[j + k]) k++;
        if (k >= 2) {
          const last = words[i + k - 1];
          out.add(line.slice(words[i].index, (last.index as number) + last[0].length));
        }
      }
    }
  }
  return [...out];
}

/** A line cut at the shared words, for underlining them. */
export function splitAt(line: string, names: string[]): { text: string; hit: boolean }[] {
  if (!names.length) return [{ text: line, hit: false }];
  const at = new RegExp(`(${[...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "g");
  return line
    .split(at)
    .filter(Boolean)
    .map((text) => ({ text, hit: names.includes(text) }));
}
