"use client";

/**
 * The photo is the stage (6.2): it stays put while every beat changes it — the scan sweep while
 * Claude reads it, the boxes of what it read, the place title, the SAM 3 layers wiping in, and the
 * aligned Hiroshige print wiping over it.
 */
import { AnimatePresence, m } from "motion/react";
import { useEffect, useState, type Ref } from "react";
import type { LiveState } from "@/lib/live/state";

type Scene = {
  size: [number, number];
  elements: Record<string, { bbox: [number, number, number, number]; png: string; layer?: string; score?: number }>;
  alignment?: { ok: boolean; overlay?: string; artifact?: string };
};

const MASK_COLOR: Record<string, string> = { lantern: "var(--lantern)", lantern_base: "var(--thread-toki)", gate: "var(--thread-ba)" };

export function useScene(sceneId: string | undefined) {
  const [scene, setScene] = useState<{ id: string; data: Scene } | null>(null);
  useEffect(() => {
    if (!sceneId) return;
    let off = false;
    fetch(`/api/cache/scenes/${sceneId}/scene.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Scene | null) => {
        if (!off && j) setScene({ id: sceneId, data: j });
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [sceneId]);
  return scene && scene.id === sceneId ? scene.data : null;
}

/** The photo point the threads start from: the lantern if SAM 3 found it, else the strongest read element. */
export function anchorBox(s: LiveState, scene: Scene | null): { x: number; y: number } | null {
  const lan = scene?.elements.lantern?.bbox;
  if (lan) return { x: (lan[0] + lan[2]) / 2, y: (lan[1] + lan[3]) / 2 };
  const el = [...(s.see?.elements ?? [])].sort((a, b) => b.box.w * b.box.h * b.confidence - a.box.w * a.box.h * a.confidence)[0];
  return el ? { x: el.box.x + el.box.w / 2, y: el.box.y + el.box.h / 2 } : null;
}

export function PhotoStage({
  s,
  photo,
  elapsed,
  scene,
  anchorRef,
  overlayOn,
  onAspect,
  aspect,
}: {
  s: LiveState;
  photo: string | null;
  elapsed: number;
  scene: Scene | null;
  anchorRef: Ref<HTMLSpanElement>;
  overlayOn: boolean;
  onAspect: (a: number) => void;
  aspect: number;
}) {
  const reading = s.stages.see && !s.see;
  const boxes = (s.see?.elements ?? []).slice(0, 6);
  const sinceSee = s.at.see !== undefined ? elapsed - s.at.see : -1;
  const sincePlace = s.at.place !== undefined ? elapsed - s.at.place : -1;
  const sinceSpace = s.at.space !== undefined ? elapsed - s.at.space : -1;
  const sinceVisual = s.at.visual !== undefined ? elapsed - s.at.visual : -1;
  const anchor = anchorBox(s, scene);
  const masks = s.space?.ok && scene ? Object.entries(scene.elements).filter(([k]) => k !== "people") : [];
  const overlay = s.space?.aligned && scene?.alignment?.ok && scene.alignment.overlay && s.space.scene_id ? `/api/cache/scenes/${s.space.scene_id}/${scene.alignment.overlay}` : null;
  // the print wipes over the photo when the visual match lands, holds, then steps back (toggle brings it back)
  const showOverlay = overlay && sinceVisual >= 0 && (overlayOn || sinceVisual < 5200);
  const placeName = s.place?.path[0]?.name; // leaf-first

  return (
    <div className="relative h-full max-w-full overflow-hidden rounded-xl bg-ink shadow-2xl ring-1 ring-muted/20" style={{ aspectRatio: aspect }} data-testid="stage-photo">
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- the visitor's own (face-blurred) photo or the CC0 sample
        <img
          src={photo}
          alt="探索している写真"
          className="absolute inset-0 size-full object-cover"
          onLoad={(e) => {
            const i = e.currentTarget;
            if (i.naturalWidth && i.naturalHeight) onAspect(i.naturalWidth / i.naturalHeight);
          }}
        />
      )}
      {/* while Claude reads the photo: a sweep and a faint grid (labor made visible) */}
      {reading && (
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="scan-grid absolute inset-0 opacity-40" />
          <div className="scan-sweep absolute inset-x-0 h-24" />
        </div>
      )}

      {/* what Claude read: boxes draw in, original text labels */}
      <svg className="pointer-events-none absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        {boxes.map((e, i) => (
          <m.rect
            key={i}
            x={e.box.x * 100}
            y={e.box.y * 100}
            width={e.box.w * 100}
            height={e.box.h * 100}
            rx={0.6}
            fill="none"
            stroke="var(--lantern)"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: sincePlace > 2600 ? 0.25 : 0.95 }}
            transition={{ pathLength: { duration: 0.6, delay: i * 0.12 }, opacity: { duration: 0.6 } }}
          />
        ))}
      </svg>
      {sinceSee >= 0 &&
        boxes
          .filter((e) => e.text_original)
          .slice(0, 3)
          .map((e, i) => (
            <m.span
              key={i}
              className="absolute max-w-[45%] rounded bg-night/85 px-2 py-0.5 text-xs shadow"
              style={{ left: `${e.box.x * 100}%`, top: `calc(${e.box.y * 100}% - 1.6rem)` }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: sincePlace > 2600 ? 0 : 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.15 }}
            >
              <span className="font-serif text-sm text-lantern">{e.text_original}</span>
              {e.meaning?.ja && <span className="ml-1 text-muted">{e.meaning.ja.slice(0, 18)}</span>}
            </m.span>
          ))}

      {/* SAM 3 layers: glowing silhouettes wipe left → right, then settle */}
      {masks.map(([k, el], i) => {
        const [x1, y1, x2, y2] = el.bbox;
        const url = `url(/api/cache/scenes/${s.space!.scene_id}/${el.png})`;
        return (
          <m.div
            key={k}
            aria-hidden
            className="pointer-events-none absolute mix-blend-screen"
            style={{
              left: `${x1 * 100}%`,
              top: `${y1 * 100}%`,
              width: `${(x2 - x1) * 100}%`,
              height: `${(y2 - y1) * 100}%`,
              background: MASK_COLOR[k] ?? "var(--thread-koto)",
              WebkitMaskImage: url,
              maskImage: url,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
            }}
            initial={{ clipPath: "inset(0 100% 0 0)", opacity: 0.7 }}
            animate={{ clipPath: "inset(0 0% 0 0)", opacity: sinceSpace > 2400 ? 0.14 : 0.6 }}
            transition={{ clipPath: { duration: 1.2, delay: i * 0.25, ease: "easeInOut" }, opacity: { duration: 1 } }}
          />
        );
      })}

      {/* the aligned print (FR-58 / 間): wipes over the photo right → left */}
      <AnimatePresence>
        {showOverlay && (
          <m.div
            key="overlay"
            className="absolute inset-0 bg-ink"
            initial={{ clipPath: "inset(0 0 0 100%)" }}
            animate={{ clipPath: "inset(0 0 0 0%)" }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
            data-testid="stage-overlay"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- public-domain print aligned to the photo */}
            <img src={overlay!} alt="広重『名所江戸百景 浅草金龍山』に写真を重ねたもの" className="size-full object-contain" />
            <span className="absolute bottom-3 left-3 rounded bg-night/80 px-2 py-1 text-xs">広重 1856 と重ねる（位置合わせ：Claudeが付けた目印＋コード）</span>
          </m.div>
        )}
      </AnimatePresence>

      {/* anchor of the threads */}
      {anchor && <span ref={anchorRef} aria-hidden className="absolute size-0" style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }} />}
      {anchor && s.at.threads !== undefined && (
        <span aria-hidden className="absolute size-3 -translate-1/2 rounded-full bg-lantern shadow-[0_0_16px_var(--lantern)]" style={{ left: `${anchor.x * 100}%`, top: `${anchor.y * 100}%` }} />
      )}

      {/* the place, big, before it docks into the text column */}
      <AnimatePresence>
        {placeName && sincePlace >= 0 && sincePlace < 1900 && (
          <m.div
            key="place-hero"
            className="absolute inset-0 flex flex-col items-center justify-center bg-night/55 text-center backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <m.span layoutId="place-ja" className="font-serif text-7xl font-bold tracking-[0.2em] text-paper drop-shadow-lg">
              {placeName.ja}
            </m.span>
            <m.span layoutId="place-en" className="mt-3 font-serif text-2xl text-lantern">
              {placeName.en}
            </m.span>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
