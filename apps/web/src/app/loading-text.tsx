"use client";

/** "Loading…" in the visitor's language, for the Suspense fallbacks of Server Component pages. */
import { dict, useDict } from "./i18n";

const T = dict({ ja: { loading: "読み込み中…" }, en: { loading: "Loading…" } });

export function LoadingText() {
  return <p className="text-muted">{useDict(T).loading}</p>;
}
