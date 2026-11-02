import { connection } from "next/server";
import { Suspense } from "react";
import { sourceTitles } from "@/lib/corpus/titles";
import { entities } from "@/lib/entities-server";
import { timelineData } from "@/lib/timeline-server";
import { TimeRiver } from "../time-river";

export const metadata = { title: "TSUMUGI — 時をめくる" };

const TARGET = "ent:kaminarimon";

/** The time river straight from the reviewed timeline (no Claude call): demo fallback and visual check. */
async function River() {
  await connection();
  const titles = sourceTitles();
  const data = timelineData(TARGET, entities().get(TARGET)?.name, (id) => titles.get(id) ?? id);
  return (
    <>
      <TimeRiver data={data} initialYear={1856} />
      <p className="text-sm text-muted">
        年表：浅草寺 公式「雷門」・観光庁 多言語解説文・高村光雲『幕末維新懐古談』。陰暦は国立天文台の暦日データベースで換算。
        {data.reviewed ? ` 人の確認：${data.reviewed.by}（${data.reviewed.at ?? ""}）` : " 人の確認：未"}
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
