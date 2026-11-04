"use client";

/**
 * Make a postcard (9:16 PNG). It is shown in the app first — the closing beat of the demo has
 * somewhere to land — then saved (shared as a file where the device can, else downloaded).
 */
import { useEffect, useState } from "react";
import { dict, useDict, useLang } from "./i18n";
import { Button } from "./ui/button";

const L = dict({
  ja: { make: "絵はがきを作る", making: "絵はがきを作っています", failed: "絵はがきを作れませんでした", save: "保存する", close: "閉じる", title: "絵はがき" },
  en: { make: "Make a postcard", making: "Making the postcard", failed: "Could not make the postcard", save: "Save", close: "Close", title: "Postcard" },
});

export function PostcardButton({ expId, className = "" }: { expId: string; className?: string }) {
  const l = useDict(L);
  const lang = useLang();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const [card, setCard] = useState<{ url: string; file: File } | null>(null);

  useEffect(() => {
    if (!card) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setCard(null);
    window.addEventListener("keydown", esc);
    return () => {
      window.removeEventListener("keydown", esc);
      URL.revokeObjectURL(card.url);
    };
  }, [card]);

  const make = async () => {
    setState("busy");
    try {
      const r = await fetch(`/api/explorations/${expId}/postcard?lang=${lang}`);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const file = new File([blob], `tsumugi-${expId.slice(4, 12)}.png`, { type: "image/png" });
      setCard({ url: URL.createObjectURL(blob), file });
      setState("idle");
    } catch {
      setState("failed");
    }
  };

  const save = async () => {
    if (!card) return;
    if (navigator.canShare?.({ files: [card.file] })) {
      await navigator.share({ files: [card.file], title: "TSUMUGI" }).catch(() => {});
      return;
    }
    const a = document.createElement("a");
    a.href = card.url;
    a.download = card.file.name;
    a.click();
  };

  return (
    <>
      <Button onClick={make} disabled={state === "busy"} className={className} data-testid="postcard-link" aria-live="polite">
        {state === "busy" ? l.making : state === "failed" ? l.failed : l.make}
      </Button>
      {card && (
        <div role="dialog" aria-modal="true" aria-label={l.title} className="fixed inset-0 z-50 flex items-center justify-center bg-night p-6" onClick={() => setCard(null)} data-testid="postcard-view">
          <figure className="page-enter flex max-h-full flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a generated blob */}
            <img src={card.url} alt={l.title} className="max-h-[78vh] w-auto rounded-md" />
            <div className="flex gap-3">
              <Button variant="primary" onClick={save} data-testid="postcard-save">
                {l.save}
              </Button>
              <Button variant="secondary" onClick={() => setCard(null)} data-testid="postcard-close">
                {l.close}
              </Button>
            </div>
          </figure>
        </div>
      )}
    </>
  );
}
