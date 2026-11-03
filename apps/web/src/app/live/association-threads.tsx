"use client";

/** FR-59 連想の糸 (pencil): passages the graph associates with this place, with the path that links them. */
import { m } from "motion/react";
import type { LiveState } from "@/lib/live/state";

export function AssociationThreads({ s }: { s: LiveState }) {
  const a = s.associations;
  if (!a?.ok || a.items.length === 0) return null;
  return (
    <section className="rounded-lg border border-dashed border-ma/50 p-3" aria-label="連想の糸" data-testid="associations">
      <h3 className="text-xs text-muted">
        <span className="font-hand text-sm text-ma">連想の糸</span>（鉛筆：根拠グラフのつながり。今回は読んでいない資料。根拠ではありません）
      </h3>
      <ul className="mt-2 flex flex-col gap-2">
        {a.items.map((x, i) => (
          <m.li key={x.passage} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }} className="text-xs">
            <p className="flex flex-wrap items-center gap-1 text-muted">
              {x.path
                .filter((p) => p.label !== "Claim")
                .map((p, j, arr) => (
                  <span key={p.id} className="inline-flex items-center gap-1">
                    <span className={p.label === "Evidence" ? "text-paper" : ""}>{p.text}</span>
                    {j < arr.length - 1 && (
                      <svg width="18" height="6" aria-hidden className="text-ma">
                        <path d="M0 3 H18" stroke="currentColor" strokeDasharray="2 3" />
                      </svg>
                    )}
                  </span>
                ))}
            </p>
            {x.text && <p className="mt-0.5 line-clamp-2 leading-relaxed text-paper/70">{x.text}</p>}
          </m.li>
        ))}
      </ul>
    </section>
  );
}
