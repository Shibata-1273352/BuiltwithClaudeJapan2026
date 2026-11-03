"use client";

/** Make a postcard (9:16 PNG): shared as a file where the device can, else downloaded. */
import { useState } from "react";
import { dict, useDict, useLang } from "./i18n";
import { Button } from "./ui/button";

const L = dict({
  ja: { make: "絵はがきを作る", making: "絵はがきを作っています", failed: "絵はがきを作れませんでした" },
  en: { make: "Make a postcard", making: "Making the postcard", failed: "Could not make the postcard" },
});

export function PostcardButton({ expId, className = "" }: { expId: string; className?: string }) {
  const l = useDict(L);
  const lang = useLang();
  const [state, setState] = useState<"idle" | "busy" | "failed">("idle");
  const make = async () => {
    setState("busy");
    try {
      const r = await fetch(`/api/explorations/${expId}/postcard?lang=${lang}`);
      if (!r.ok) throw new Error(String(r.status));
      const blob = await r.blob();
      const file = new File([blob], `tsumugi-${expId.slice(4, 12)}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "TSUMUGI" }).catch(() => {});
      else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      }
      setState("idle");
    } catch {
      setState("failed");
    }
  };
  return (
    <Button onClick={make} disabled={state === "busy"} className={className} data-testid="postcard-link" aria-live="polite">
      {state === "busy" ? l.making : state === "failed" ? l.failed : l.make}
    </Button>
  );
}
