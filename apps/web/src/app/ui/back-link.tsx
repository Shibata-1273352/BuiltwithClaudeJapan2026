"use client";

/** Back to where the visitor came from (the stage), or to the start when opened directly. */
import { useRouter } from "next/navigation";
import { useLang } from "../i18n";

export function BackLink({ className = "" }: { className?: string }) {
  const ja = useLang() === "ja";
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (history.length > 1 ? router.back() : router.push("/"))}
      className={`inline-flex min-h-11 items-center gap-1 text-small text-muted hover:text-paper ${className}`}
      data-testid="back-link"
    >
      <span aria-hidden>←</span>
      {ja ? "戻る" : "Back"}
    </button>
  );
}
