"use client";

/** Sound and vibration on or off (the plucked string, the haptic tick); remembered per browser. */
import { useSyncExternalStore } from "react";
import { isMuted, setMuted, subscribeMute } from "@/lib/live/feel";
import { useLang } from "../i18n";
import { Button } from "../ui/button";

export function MuteToggle() {
  const muted = useSyncExternalStore(subscribeMute, isMuted, () => false);
  const ja = useLang() === "ja";
  return (
    <Button variant="quiet" onClick={() => setMuted(!muted)} aria-pressed={!muted} data-testid="mute-toggle">
      {ja ? (muted ? "音：切" : "音：入") : muted ? "Sound off" : "Sound on"}
    </Button>
  );
}
