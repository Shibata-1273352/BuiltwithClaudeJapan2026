import { connection } from "next/server";
import { Suspense } from "react";
import { sourceTitles } from "@/lib/corpus/titles";
import { entities } from "@/lib/entities-server";
import { timeline, timelineData } from "@/lib/timeline-server";
import { TimeRiver } from "../time-river";

export const metadata = { title: "TSUMUGI — 時をめくる" };

const DEFAULT = "ent:kaminarimon";

/** Entities that have reviewed existence events (others are rejected, not looked up). */
function sites(): string[] {
  return [...timeline().periods.keys()];
}

/** The time river straight from the reviewed timeline (no Claude call): demo fallback and visual check. */
async function River({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await connection();
  const asked = (await searchParams).entity;
  const target = asked && sites().includes(asked) ? asked : DEFAULT;
  const titles = sourceTitles();
  const E = entities();
  const data = timelineData(target, E.get(target)?.name, (id) => titles.get(id) ?? id);
  return (
    <>
      <nav className="flex flex-wrap gap-2 text-sm" data-testid="time-sites">
        {sites().map((id) => (
          <a key={id} href={`/time?entity=${encodeURIComponent(id)}`} className={`rounded-full border px-3 py-1 ${id === target ? "border-lantern" : "border-muted/40"}`}>
            {E.get(id)?.name.ja ?? id}
          </a>
        ))}
      </nav>
      <h2 className="font-serif text-2xl">{E.get(target)?.name.ja}はいつ、そこにあったか</h2>
      <TimeRiver data={data} initialYear={1856} />
      <p className="text-sm text-muted">
        年表の典拠は各出来事の出典を参照。陰暦は国立天文台の暦日データベースで換算。
        {data.reviewed ? ` 人の確認：${data.reviewed.by}（${data.reviewed.at ?? ""}）` : " 人の確認：未"}
      </p>
    </>
  );
}

export default function TimePage({ searchParams }: PageProps<"/time">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="font-serif text-4xl">時をめくる</h1>
      <Suspense fallback={<p className="text-muted">読み込み中…</p>}>
        <River searchParams={searchParams as Promise<{ entity?: string }>} />
      </Suspense>
    </main>
  );
}
