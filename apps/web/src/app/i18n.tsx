"use client";

/**
 * Japanese / English on every screen (FR-40). The choice lives in a cookie and on <html lang>;
 * runs started afterwards use it as their UI language. Default: Japanese.
 * Strings stay next to their component as `{ ja: {...}, en: {...} }`, and `dict()` makes the
 * compiler check that both languages have the same keys.
 */
import { createContext, useCallback, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";

export type Lang = "ja" | "en";
const COOKIE = "tsumugi_lang";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "ja", setLang: () => {} });

function readCookie(): Lang | null {
  const m = typeof document !== "undefined" ? document.cookie.match(/(?:^|; )tsumugi_lang=(ja|en)/) : null;
  return (m?.[1] as Lang) ?? null;
}

// the language is an external store: the cookie (or ?lang=), with listeners for the toggle
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => listeners.delete(f);
};
const snapshot = (): Lang => {
  const q = new URLSearchParams(location.search).get("lang");
  return q === "en" || q === "ja" ? q : (readCookie() ?? "ja");
};

export function LangProvider({ children }: { children: ReactNode }) {
  const lang = useSyncExternalStore(subscribe, snapshot, () => "ja" as Lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const setLang = useCallback((l: Lang) => {
    document.cookie = `${COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    const u = new URL(location.href);
    if (u.searchParams.has("lang")) {
      u.searchParams.set("lang", l);
      history.replaceState(null, "", u);
    }
    listeners.forEach((f) => f());
  }, []);
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export const useLang = () => useContext(Ctx).lang;
export const useSetLang = () => useContext(Ctx).setLang;

/** `const L = dict({ ja: {...}, en: {...} })`: en must have exactly the keys of ja. */
export function dict<T extends Record<string, unknown>>(d: { ja: T; en: { [K in keyof T]: T[K] } }) {
  return d;
}

/** The strings of a dictionary in the current language. */
export function useDict<T>(d: { ja: T; en: T }): T {
  return d[useLang()];
}

export function LangToggle({ className = "" }: { className?: string }) {
  const lang = useLang();
  const setLang = useSetLang();
  return (
    <div className={`flex rounded-sm border border-rule-strong text-caption ${className}`} role="group" aria-label="Language / 言語" data-testid="lang-toggle">
      {(["ja", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`min-h-9 min-w-10 px-2 ${lang === l ? "bg-paper text-night" : "text-muted hover:text-paper"}`}
          data-testid={`lang-${l}-toggle`}
        >
          {l === "ja" ? "日本語" : "EN"}
        </button>
      ))}
    </div>
  );
}
