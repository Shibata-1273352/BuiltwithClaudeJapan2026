"use client";

/**
 * FR-01: a full-screen viewfinder (rear camera), a lantern-coloured shutter. The frame is handed to
 * the same preprocessing as a chosen file (face blur before anything leaves the device). Without
 * camera permission or support, the caller's file picker remains the way in.
 */
import { useEffect, useRef, useState } from "react";

export function cameraSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

export function Camera({ onShot, onClose, labels }: { onShot: (f: File) => void; onClose: () => void; labels: { shutter: string; close: string; denied: string; starting: string } }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [state, setState] = useState<"starting" | "live" | "denied">("starting");

  useEffect(() => {
    let off = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 2560 }, height: { ideal: 1920 } }, audio: false })
      .then((s) => {
        if (off) return s.getTracks().forEach((t) => t.stop());
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          void video.current.play();
        }
        setState("live");
      })
      .catch(() => !off && setState("denied"));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => {
      off = true;
      window.removeEventListener("keydown", esc);
      stream.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onClose]);

  const shoot = () => {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")!.drawImage(v, 0, 0);
    c.toBlob((b) => {
      if (!b) return;
      stream.current?.getTracks().forEach((t) => t.stop());
      onShot(new File([b], "camera.jpg", { type: "image/jpeg" }));
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label={labels.shutter} data-testid="camera">
      <video ref={video} playsInline muted className="min-h-0 flex-1 object-cover" />
      {state !== "live" && <p className="absolute inset-x-6 top-1/3 text-center font-serif text-lead text-paper">{state === "denied" ? labels.denied : labels.starting}</p>}
      <div className="flex items-center justify-between px-8 py-6">
        <button type="button" onClick={onClose} className="min-h-11 min-w-11 text-small text-paper underline underline-offset-4" data-testid="camera-close">
          {labels.close}
        </button>
        <button
          type="button"
          onClick={shoot}
          disabled={state !== "live"}
          aria-label={labels.shutter}
          className="size-18 rounded-full border-4 border-paper bg-lantern transition-transform active:scale-95 disabled:opacity-40"
          data-testid="camera-shutter"
        />
        <span className="min-w-11" />
      </div>
    </div>
  );
}
