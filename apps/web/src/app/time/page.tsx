import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { sourceTitles } from "@/lib/corpus/titles";
import { entities } from "@/lib/entities-server";
import { timeline, timelineData } from "@/lib/timeline-server";
import { BackLink } from "../ui/back-link";
import { TimeRiver } from "../time-river";

export const metadata = { title: "TSUMUGI — 時をめくる" };

const DEFAULT = "ent:kaminarimon";

const L = {
  ja: {
    title: "時をめくる",
    when: (n: string) => `${n}はいつ、そこにあったか`,
    note: "年表の典拠は各出来事の出典を参照。陰暦は国立天文台の暦日データベースで換算。",
    reviewed: (at: string | null) => ` 人が確認済み${at ? `（${at}）` : ""}`,
    unreviewed: " 人の確認：未",
  },
  en: {
    title: "Turn the years",
    when: (n: string) => `When did ${n} stand here?`,
    note: "Each date cites its source. Lunar dates converted with the calendar database of the National Astronomical Observatory of Japan.",
    reviewed: (at: string | null) => ` Checked by a person${at ? ` (${at})` : ""}.`,
    unreviewed: " Not yet checked by a person.",
  },
} as const;

/** Entities that have reviewed existence events (others are rejected, not looked up). */
function sites(): string[] {
  return [...timeline().periods.keys()];
}

/** The time river straight from the reviewed timeline (no Claude call): demo fallback and visual check. */
async function River({ searchParams }: { searchParams: Promise<{ entity?: string }> }) {
  await connection();
  const lang = (await cookies()).get("tsumugi_lang")?.value === "en" ? "en" : "ja";
  const l = L[lang];
  const asked = (await searchParams).entity;
  const target = asked && sites().includes(asked) ? asked : DEFAULT;
  const titles = sourceTitles();
  const E = entities();
  const data = timelineData(target, E.get(target)?.name, (id) => titles.get(id) ?? id);
  const nameOf = (id: string) => E.get(id)?.name[lang] ?? id;
  return (
    <>
      <BackLink className="-ml-1 self-start" />
      <h1 className="font-serif text-display">{l.title}</h1>
      <nav className="flex flex-wrap gap-2 text-small" data-testid="time-sites">
        {sites().map((id) => (
          <a key={id} href={`/time?entity=${encodeURIComponent(id)}`} className={`inline-flex min-h-11 items-center border-b-2 px-1 text-small ${id === target ? "border-paper text-paper" : "border-transparent text-muted hover:text-paper"}`}>
            {nameOf(id)}
          </a>
        ))}
      </nav>
      <h2 className="font-serif text-title">{l.when(nameOf(target))}</h2>
      <TimeRiver data={data} initialYear={1856} />
      <p className="text-small text-muted">
        {l.note}
        {data.reviewed ? l.reviewed(data.reviewed.at ?? null) : l.unreviewed}
      </p>
    </>
  );
}

export default function TimePage({ searchParams }: PageProps<"/time">) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10">
      <Suspense fallback={<p className="text-muted">…</p>}>
        <River searchParams={searchParams as Promise<{ entity?: string }>} />
      </Suspense>
    </main>
  );
}
