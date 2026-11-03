"use client";

/**
 * The touchable objects of the loom (6.2 screens 2–3, Loom): SAM 3's cut-outs lift off the photo
 * after a light sweeps their outline. Touch one and it trembles (a spring), its threads are plucked
 * (sound, vibration); drag it and its threads pull taut, let go and it swings back; tap it (or Enter)
 * to open what it holds. Before the cut-outs arrive, Claude's boxes are already touchable.
 * People are never a target. Keyboard: every object is a button.
 */
import { m, useAnimate } from "motion/react";
import { useRef } from "react";
import type { LoomObject } from "@/lib/live/objects";
import { dict, useDict } from "../i18n";

const L = dict({
  ja: { open: (l: string) => `${l}：触れる・開く`, hint: "触れて、引いてみる" },
  en: { open: (l: string) => `${l}: touch to open`, hint: "Touch it, pull it" },
});

export function ObjectsLayer({
  objects,
  sceneId,
  lifted,
  faded,
  selected,
  register,
  onTouch,
  onSelect,
}: {
  objects: LoomObject[];
  sceneId: string | null;
  /** SAM 3 has finished: cut-outs lift */
  lifted: boolean;
  /** the time scrub is in a year when this object did not exist */
  faded: boolean;
  selected: string | null;
  register: (key: string) => (el: HTMLElement | null) => void;
  onTouch: (key: string) => void;
  onSelect: (key: string) => void;
}) {
  const l = useDict(L);
  return (
    <>
      {objects.map((o, i) => (
        <TouchObject key={o.key} o={o} i={i} sceneId={sceneId} lifted={lifted} faded={faded} selected={selected === o.key} register={register} onTouch={onTouch} onSelect={onSelect} label={l.open(o.label)} hint={l.hint} />
      ))}
    </>
  );
}

function TouchObject({
  o,
  i,
  sceneId,
  lifted,
  faded,
  selected,
  register,
  onTouch,
  onSelect,
  label,
  hint,
}: {
  o: LoomObject;
  i: number;
  sceneId: string | null;
  lifted: boolean;
  faded: boolean;
  selected: boolean;
  register: (key: string) => (el: HTMLElement | null) => void;
  onTouch: (key: string) => void;
  onSelect: (key: string) => void;
  label: string;
  hint: string;
}) {
  const [scope, animate] = useAnimate();
  const lastTouch = useRef(0);
  const dragged = useRef(false);
  const cut = o.png && sceneId && lifted ? `/api/cache/scenes/${sceneId}/${o.png}` : null;
  const touch = () => {
    const now = performance.now();
    if (now - lastTouch.current < 350) return;
    lastTouch.current = now;
    onTouch(o.key);
    // a spring tremble: the object answers the hand
    void animate(scope.current, { rotate: [0, -1.8, 1.6, -0.9, 0.5, 0], scale: [1, 1.04, 1.02] }, { duration: 0.55, ease: "easeOut" });
  };
  return (
    <m.button
      ref={scope}
      type="button"
      aria-label={label}
      aria-pressed={selected}
      data-testid="object-lift"
      data-object={o.key}
      className={`group absolute cursor-grab touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-lantern active:cursor-grabbing ${selected ? "ring-1 ring-paper/70" : ""}`}
      style={{ left: `${o.box.x * 100}%`, top: `${o.box.y * 100}%`, width: `${o.box.w * 100}%`, height: `${o.box.h * 100}%`, zIndex: 5 + i }}
      drag
      dragSnapToOrigin
      dragElastic={0.35}
      dragMomentum={false}
      onDragStart={() => {
        dragged.current = true;
        touch();
      }}
      onDragEnd={() => {
        touch(); // the release swings the threads
        setTimeout(() => (dragged.current = false), 0);
      }}
      onPointerEnter={touch}
      onClick={() => {
        if (dragged.current) return;
        touch();
        onSelect(o.key);
      }}
      initial={false}
      animate={{ opacity: faded ? 0.14 : 1, y: cut && !faded ? -12 : 0, scale: cut && !faded ? 1.03 : 1, filter: faded ? "grayscale(1)" : "grayscale(0)" }}
      transition={{ opacity: { duration: 0.6 }, y: { type: "spring", stiffness: 260, damping: 18, delay: 0.3 + i * 0.15 } }}
    >
      {cut && (
        <>
          {/* the cut-out, lifted with a soft shadow */}
          {/* eslint-disable-next-line @next/next/no-img-element -- SAM 3 cut-out PNG with alpha */}
          <img src={cut} alt="" draggable={false} className="pointer-events-none size-full select-none [filter:drop-shadow(0_10px_14px_rgb(0_0_0/0.55))]" />
          {/* a light sweeps its outline once */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              WebkitMaskImage: `url(${cut})`,
              maskImage: `url(${cut})`,
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
              background: "linear-gradient(100deg, transparent 35%, rgb(255 236 200 / 0.75) 50%, transparent 65%)",
              backgroundSize: "250% 100%",
              animation: `object-sweep-bg 1.4s ease-out ${0.15 * i}s 1 both`,
            }}
          />
        </>
      )}
      {!cut && <span aria-hidden className="pointer-events-none absolute inset-0 rounded-md border border-paper/0 transition-colors group-hover:border-paper/50" />}
      {cut && i === 0 && !selected && (
        <span aria-hidden className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 animate-pulse rounded-sm bg-night/80 px-2 py-0.5 text-caption whitespace-nowrap text-paper" data-testid="touch-hint">
          {hint}
        </span>
      )}
      {/* where its threads are tied */}
      <span ref={register(`obj:${o.key}`)} aria-hidden className="absolute top-1/2 left-1/2 size-0" />
    </m.button>
  );
}
