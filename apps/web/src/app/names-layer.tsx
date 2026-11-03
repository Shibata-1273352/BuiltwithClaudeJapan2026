"use client";

/**
 * 言の地層 (FR-24) with FR-27: tap a name to compare how each source writes that entity — every
 * usage, grouped by language, with the source, its time and the original sentence (name
 * highlighted). The quotes are the canonical sentences; nothing here is written by Claude.
 */
import { useState } from "react";

export type NameUsage = { text: string; lang: "en" | "ja"; specificity: string; sourceTitle: string; time: string | null; sentence: string; sentenceId: string; start?: number };
export type NamesData = Record<string, { name?: { ja: string; en: string }; type?: string; usages: NameUsage[] }>;

/** The sentence with the name at `start` (code points) highlighted; falls back to the first match. */
export function splitAtName(sentence: string, text: string, start?: number): [string, string, string] {
  const cps = [...sentence];
  let s = start ?? -1;
  if (s < 0 || cps.slice(s, s + [...text].length).join("") !== text) {
    const i = sentence.indexOf(text);
    s = i < 0 ? -1 : [...sentence.slice(0, i)].length;
  }
  if (s < 0) return [sentence, "", ""];
  const n = [...text].length;
  return [cps.slice(0, s).join(""), cps.slice(s, s + n).join(""), cps.slice(s + n).join("")];
}

export function NamesLayer({ names, lang }: { names: NamesData; lang: "ja" | "en" }) {
  const [open, setOpen] = useState<string | null>(null);
  const g = open ? names[open] : undefined;
  const byLang = (l: "en" | "ja") => (g?.usages ?? []).filter((u) => u.lang === l);
  return (
    <div data-testid="names">
      <h3 className="font-serif text-lg">{lang === "ja" ? "言：誰が、何を、どう呼んだか" : "Names: who called what, and how"}</h3>
      <p className="text-xs text-muted">{lang === "ja" ? "呼び名を押すと、資料ごとの書き方を比べられます。" : "Tap a name to compare how each source writes it."}</p>
      {Object.entries(names).map(([id, grp]) => (
        <div key={id} className="mb-2">
          <p className="text-sm font-bold">
            {grp.name?.[lang]} <span className="font-normal text-muted">（{grp.type}）</span>
          </p>
          <ul className="flex flex-wrap gap-x-3 text-sm">
            {grp.usages.slice(0, 6).map((u, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => setOpen(open === id ? null : id)}
                  aria-expanded={open === id}
                  className="min-h-11 text-left underline decoration-dotted underline-offset-4"
                  data-testid="name-chip"
                >
                  <span lang={u.lang} className="text-koto">
                    {u.text}
                  </span>
                  {u.specificity === "ambiguous" ? <span className="text-muted">（{lang === "ja" ? "曖昧" : "ambiguous"}）</span> : null}
                  <span className="text-muted">
                    {" "}
                    — {u.sourceTitle}
                    {u.time ? `（${u.time.slice(0, 4)}）` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {open === id && g && (
            <div className="mt-2 grid gap-3 rounded-lg border border-koto/40 p-3 md:grid-cols-2" data-testid="name-compare">
              {(["en", "ja"] as const).map((l) => (
                <section key={l}>
                  <h4 className="mb-1 text-xs tracking-widest text-muted">{l === "en" ? "English" : "日本語"}（{byLang(l).length}）</h4>
                  {byLang(l).length === 0 ? (
                    <p className="text-sm text-muted">{lang === "ja" ? "この言語の資料には見つかりませんでした。" : "Not found in sources in this language."}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {byLang(l).map((u, i) => {
                        const [a, b, c] = splitAtName(u.sentence, u.text, u.start);
                        return (
                          <li key={i} className="text-sm">
                            <p className="text-xs text-muted">
                              {u.sourceTitle}
                              {u.time ? `（${u.time.slice(0, 4)}）` : ""} · <span className="font-mono">{u.sentenceId}</span>
                            </p>
                            <blockquote lang={u.lang} className="border-l-2 border-koto pl-2 font-serif">
                              {a}
                              <mark className="rounded-sm bg-koto/30 px-0.5 text-paper">{b}</mark>
                              {c.length > 160 ? `${c.slice(0, 160)}…` : c}
                            </blockquote>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
