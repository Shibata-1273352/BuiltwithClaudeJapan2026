"use client";

/**
 * Who produced this: Claude (lantern, it is the live voice) or code (a hairline). One mark instead of a
 * sentence ("read from the photo by Claude", "checked against the timeline by code"), so the split stays
 * visible while the screen carries fewer words (CLAUDE.md honesty: what Claude produced and what code
 * decided, shown separately). An optional word says what was done.
 */
import { useLang } from "../i18n";

export function By({ who, did }: { who: "claude" | "code"; did?: { ja: string; en: string } }) {
  const lang = useLang();
  const name = who === "claude" ? "Claude" : lang === "ja" ? "プログラム" : "code";
  return (
    <span className="inline-flex items-center gap-1.5 text-caption leading-5 whitespace-nowrap" data-by={who}>
      <span className={`rounded-sm border px-1.5 ${who === "claude" ? "border-lantern/60 text-lantern" : "border-rule-strong text-muted"}`}>{name}</span>
      {did && <span className="text-muted">{did[lang]}</span>}
    </span>
  );
}
