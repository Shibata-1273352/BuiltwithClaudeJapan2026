"use client";

/** FR-59 連想の糸 (pencil): passages the graph associates with this place, with the path that links them. */
import { m } from "motion/react";
import type { LiveState } from "@/lib/live/state";
import { Pencil } from "../ui/marks";

export function AssociationThreads({ s }: { s: LiveState }) {
  const a = s.associations;
  if (!a?.ok || a.items.length === 0) return null;
  return (
    <section className="present-hide border-t border-rule pt-3" aria-label="連想の糸" data-testid="associations">
      <p className="label">
        連想の糸 <Pencil /> <span className="ml-1">根拠グラフがつなぐ、今回は読んでいない資料</span>
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {a.items.slice(0, 3).map((x, i) => (
          <m.li key={x.passage} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.2 }} className="text-caption">
            <p className="flex items-center gap-1 overflow-hidden whitespace-nowrap text-muted">
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
            {x.text && <p className="truncate text-paper/70">{x.text}</p>}
          </m.li>
        ))}
      </ul>
    </section>
  );
}
