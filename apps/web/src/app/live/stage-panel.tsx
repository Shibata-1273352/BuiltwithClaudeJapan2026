"use client";

/** A panel that rises over the stage (舞台裏, 時をめくる, 言の地層) without leaving the run. */
import { m } from "motion/react";

export function StagePanel({ title, onClose, children, testid, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; testid: string; wide?: boolean }) {
  return (
    <m.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`absolute inset-x-0 bottom-0 z-30 max-h-[78%] overflow-y-auto rounded-t-xl border-t border-lantern/40 bg-night-2/97 p-5 shadow-2xl backdrop-blur ${wide ? "lg:left-[20%] lg:right-0" : "lg:left-auto lg:w-[600px]"}`}
      aria-label={title}
      data-testid={testid}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lg">{title}</h2>
        <button type="button" onClick={onClose} className="min-h-9 rounded-full px-3 text-sm text-muted hover:text-paper">
          閉じる
        </button>
      </div>
      <div className="mt-3">{children}</div>
    </m.aside>
  );
}
