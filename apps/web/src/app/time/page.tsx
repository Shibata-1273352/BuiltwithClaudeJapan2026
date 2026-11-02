import { connection } from "next/server";
import { Suspense } from "react";
import { openDb } from "@/lib/corpus/db";
import { entities } from "@/lib/entities-server";
import { existenceFor, timeline } from "@/lib/timeline-server";
import type { TimelineData } from "@/lib/time-river";
import { TimeRiver } from "../time-river";

export const metadata = { title: "TSUMUGI — 時をめくる" };

const TARGET = "ent:kaminarimon";

/** The time river straight from the reviewed timeline (no Claude call): demo fallback and visual check. */
async function River() {
  await connection();
  const tl = timeline();
  const E = entities();
  const db = openDb({ readonly: true });
  let titles = new Map<string, string>();
  try {
    titles = new Map((db.prepare("SELECT id, title FROM sources").all() as { id: string; title: string }[]).map((r) => [r.id, r.title]));
  } finally {
    db.close();
  }
  const data: TimelineData = {
    entity: TARGET,
    name: E.get(TARGET)?.name,
    periods: tl.periods.get(TARGET) ?? [],
    events: tl.t.existence_events.filter((e) => e.entity === TARGET),
    sources: tl.t.source_times.map((s) => {
      const j = existenceFor(TARGET, s.source);
      return {
        source: s.source,
        title: titles.get(s.source) ?? s.source,
        time: j.time ? { kind: j.time.kind, start: j.time.start, end: j.time.end ?? null } : null,
        relation: j.relation?.kind ?? null,
        value: j.value,
        reason: j.reason,
      };
    }),
  };
  return (
    <>
      <TimeRiver data={data} initialYear={1856} />
      <p className="text-sm text-muted">
        年表：浅草寺 公式「雷門」・観光庁 多言語解説文・高村光雲『幕末維新懐古談』。陰暦は国立天文台の暦日データベースで換算。
        {tl.t.reviewed_by ? ` 人の確認：${tl.t.reviewed_by}（${(tl.t as { reviewed_at?: string }).reviewed_at ?? ""}）` : " 人の確認：未"}
      </p>
    </>
  );
}

export default function TimePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-4xl">時：雷門はいつ、そこにあったか</h1>
      <Suspense fallback={<p className="text-muted">読み込み中…</p>}>
        <River />
      </Suspense>
    </main>
  );
}
