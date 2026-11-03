"use client";

/** A panel that rises over the stage (舞台裏, 時をめくる, 言の地層) without leaving the run. */
import { useLang } from "../i18n";
import { m } from "motion/react";
import { Button } from "../ui/button";

export function StagePanel({ title, onClose, children, testid, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; testid: string; wide?: boolean }) {
  return (
    <m.aside
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`absolute inset-x-0 bottom-0 z-30 max-h-[78%] overflow-y-auto rounded-t-md border-t border-rule-strong bg-night-2 px-6 pt-5 pb-6 ${wide ? "lg:left-[32%] lg:right-0" : "lg:left-auto lg:w-[37.5rem]"}`}
      aria-label={title}
      data-testid={testid}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="font-serif text-lead">{title}</h2>
        <Button variant="quiet" onClick={onClose}>
          {useLang() === "ja" ? "閉じる" : "Close"}
        </Button>
      </div>
      <div className="mt-3">{children}</div>
    </m.aside>
  );
}
