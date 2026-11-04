/**
 * Resolve each reviewed-timeline event's evidence (passage ids) to the stored sentences, with the
 * source's title and language. Public corpus data only; read-only.
 */
import { openDb } from "./corpus/db";
import { sourceMeta } from "./corpus/titles";
import { timeline } from "./timeline-server";
import type { EventQuotes, Quote } from "./timeline-quotes";

export function eventQuotes(entityId: string): EventQuotes {
  const tl = timeline();
  const meta = sourceMeta();
  const db = openDb({ readonly: true });
  try {
    const bySentence = db.prepare("SELECT text FROM sentences WHERE passage_id = ? ORDER BY n");
    const out: EventQuotes = {};
    for (const e of tl.t.existence_events.filter((x) => x.entity === entityId)) {
      const qs: Quote[] = [];
      for (const ev of e.evidence ?? []) {
        const source = ev.split(":")[0];
        const m = meta.get(source);
        if (!m) continue;
        const text = (bySentence.all(ev) as { text: string }[]).map((r) => r.text).join("");
        if (text) qs.push({ text, source, title: m.title, lang: m.lang === "en" ? "en" : "ja" });
      }
      out[e.id] = qs;
    }
    return out;
  } finally {
    db.close();
  }
}
