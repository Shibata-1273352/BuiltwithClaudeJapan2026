"use client";

/**
 * Pull the thread (FR-60): the visitor asks — a suggested question from a guide note, or their own —
 * and Claude answers from this run's passages with native citations. Code keeps only the citations
 * it finds in the corpus; each one spins a new ink cord to its evidence card. Sentences without a
 * citation are shown muted, and an answer with none is "not in the sources".
 */
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { AskCitation, AskSegment } from "@/lib/ask-check";
import { dict, useDict } from "../i18n";
import { Button } from "../ui/button";

export type AskItem = {
  q: string;
  status: "asking" | "done" | "error";
  ok?: boolean;
  reason?: string;
  segments?: AskSegment[];
  costUsd?: number;
  elapsedMs?: number;
};

const L = dict({
  ja: {
    title: "糸を引く",
    sub: "Claude が今回の資料だけから答え、引用はコードが原文と照合します",
    placeholder: "この場所について聞いてみる",
    ask: "聞く",
    asking: "Claude が資料を読んでいます",
    none: "今回の資料には書かれていません。",
    refused: "この質問には答えられません。",
    error: "答えを受け取れませんでした。",
    limit: "質問の上限に達しました（1時間に10問）。",
    meta: (s: string, c: string) => `${s} 秒 · $${c}`,
  },
  en: {
    title: "Pull the thread",
    sub: "Claude answers only from this run's sources; code checks each quote against the original",
    placeholder: "Ask about this place",
    ask: "Ask",
    asking: "Claude is reading the sources",
    none: "This is not in the sources.",
    refused: "This question cannot be answered.",
    error: "No answer came back.",
    limit: "Question limit reached (10 an hour).",
    meta: (s: string, c: string) => `${s} s · $${c}`,
  },
});

/** Sources numbered in the order the answer first cites them. */
function orderOf(segments: AskSegment[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const sg of segments) for (const c of sg.cites) if (!m.has(c.sourceId)) m.set(c.sourceId, m.size + 1);
  return m;
}

export function AskPanel({ items, onAsk, register, disabled }: { items: AskItem[]; onAsk: (q: string) => void; register: (key: string) => (el: HTMLElement | null) => void; disabled?: boolean }) {
  const l = useDict(L);
  const [q, setQ] = useState("");
  const busy = items.some((x) => x.status === "asking");
  // bring the newest answer into view as it lands (the text column scrolls)
  const last = useRef<HTMLDivElement | null>(null);
  const lastDone = items.filter((x) => x.status !== "asking").length;
  useEffect(() => {
    if (lastDone) last.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [lastDone]);
  return (
    <section className="flex flex-col gap-3" aria-label={l.title} data-testid="ask-panel">
      <div>
        <p className="label">{l.title}</p>
        <p className="mt-0.5 text-caption text-muted">{l.sub}</p>
      </div>
      <AnimatePresence initial={false}>
        {items.map((it, i) => (
          <m.div key={i} ref={(el) => {
              register(`ask:${i}`)(el);
              if (i === items.length - 1) last.current = el;
            }} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="border-l-2 border-rule-strong pl-4" data-testid="ask-answer">
            <p className="font-serif text-body text-paper/80">{it.q}</p>
            {it.status === "asking" && <p className="shimmer mt-1 rounded-sm text-caption text-muted">{l.asking}</p>}
            {it.status === "error" && <p className="mt-1 text-small text-muted">{it.reason === "hourly_limit" ? l.limit : l.error}</p>}
            {it.status === "done" && !it.ok && (
              <p className="mt-1 font-serif text-body text-paper" data-testid="ask-not-found">
                {it.reason === "refused" ? l.refused : l.none}
              </p>
            )}
            {it.status === "done" && it.ok && (
              <p className="mt-1 font-serif text-body">
                {it.segments!.map((sg, j) => (
                  <span key={j} className={sg.cites.length ? "text-paper" : "text-paper/60"}>
                    {sg.text}
                    {sg.cites.length > 0 && <Cites cites={sg.cites} order={orderOf(it.segments!)} />}
                  </span>
                ))}
              </p>
            )}
            {it.status === "done" && it.ok && (
              <ol className="mt-1 flex flex-col text-caption text-muted">
                {[...orderOf(it.segments!).entries()].map(([sid, n]) => {
                  const c = it.segments!.flatMap((x) => x.cites).find((x) => x.sourceId === sid)!;
                  return (
                    <li key={sid}>
                      {n}. {c.title}
                      {c.year ? ` (${c.year})` : ""}
                    </li>
                  );
                })}
              </ol>
            )}
            {it.status === "done" && it.elapsedMs !== undefined && <p className="mt-1 text-caption text-muted tabular-nums">Claude · {l.meta((it.elapsedMs / 1000).toFixed(1), (it.costUsd ?? 0).toFixed(3))}</p>}
          </m.div>
        ))}
      </AnimatePresence>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const v = q.trim();
          if (v.length < 2 || busy) return;
          onAsk(v);
          setQ("");
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={200}
          placeholder={l.placeholder}
          aria-label={l.placeholder}
          className="min-h-11 min-w-0 flex-1 rounded-sm border border-rule-strong bg-transparent px-3 text-small text-paper placeholder:text-muted focus:border-paper/60 focus:outline-none"
          data-testid="ask-input"
          disabled={disabled}
        />
        <Button type="submit" disabled={disabled || busy || q.trim().length < 2} data-testid="ask-submit">
          {l.ask}
        </Button>
      </form>
    </section>
  );
}

function Cites({ cites, order }: { cites: AskCitation[]; order: Map<string, number> }) {
  return (
    <>
      {cites.map((c, k) => (
        <sup key={k} className="ml-0.5 font-sans text-caption text-muted tabular-nums" title={`${c.title}${c.year ? ` (${c.year})` : ""}: “${c.quote}”`}>
          {order.get(c.sourceId) ?? "?"}
        </sup>
      ))}
    </>
  );
}
