"use client";
import { BackLink } from "../../ui/back-link";
import { Button } from "../../ui/button";
import { PrintDiorama } from "./diorama";
import { Tag } from "../../ui/marks";
import { useLang } from "../../i18n";
import { LazyMotion, domAnimation, m } from "motion/react";

const L = {
  ja: {
    inside: "絵の中",
    print: "歌川広重《名所江戸百景 浅草金龍山》1856",
    how: "版画の奥行きを推定して開いています（推定）。ポインタで覗き込めます。",
    back: "今へ戻る",
    state: { present: "あった", absent: "不在", unknown: "確認待ち", withheld: "判定保留" },
    title: "間（ま）",
    sub: "写真を SAM 3 と深度で層に分け、広重の絵と重ねる",
    enter: "絵の中へ ── 広重 1856",
    flat: "平面に戻す",
    split: "層に割る",
    people: "人の層",
    peopleAria: "人の層の濃さ",
    peopleNote: "人を薄くすると、その下は周囲から補った背景です（推定）。",
    time: "時をめくる",
    yearAria: "年を選ぶ",
    overlay: "重ねる ── 歌川広重《浅草金龍山》1856",
    overlayAria: "広重の絵を重ねる割合",
    auto: "1866年の焼失より前は、広重が描いた門の時代として自動で重ねています。",
    anchor: "大提灯の下端と左端で位置を合わせています。",
    layers: "層の一覧",
    layer: { foreground: "前景", midground: "中景", background: "背景" } as Record<string, string>,
    name: { lantern: "大提灯", lantern_base: "提灯の金具", gate: "門", people: "人" } as Record<string, string>,
  },
  en: {
    inside: "Inside the print",
    print: "Utagawa Hiroshige, Kinryūzan Temple in Asakusa (1856)",
    how: "The print opens by its estimated depth (an estimate). Move the pointer to look around.",
    back: "Back to now",
    state: { present: "stood", absent: "absent", unknown: "to be checked", withheld: "withheld" },
    title: "Ma — the space between",
    sub: "The photo split into layers by SAM 3 and depth, laid over Hiroshige's print",
    enter: "Into the print — Hiroshige 1856",
    flat: "Flatten",
    split: "Split into layers",
    people: "People layer",
    peopleAria: "Opacity of the people layer",
    peopleNote: "Under the people, the background is filled in from around them (an estimate).",
    time: "Turn the years",
    yearAria: "Choose a year",
    overlay: "Lay over — Utagawa Hiroshige, Kinryūzan Temple in Asakusa (1856)",
    overlayAria: "How much of Hiroshige's print to lay over",
    auto: "Before the 1866 fire, the gate Hiroshige drew stood here, so the print is laid over automatically.",
    anchor: "Aligned at the bottom and left edge of the great lantern.",
    layers: "Layers",
    layer: { foreground: "foreground", midground: "midground", background: "background" } as Record<string, string>,
    name: { lantern: "Great lantern", lantern_base: "Lantern base", gate: "Gate", people: "People" } as Record<string, string>,
  },
} as const;
const LAYER_JA: Record<string, string> = { lantern: "大提灯", lantern_base: "提灯の金具", gate: "門", people: "人" };
const debugOn = () => typeof location !== "undefined" && new URLSearchParams(location.search).get("debug") === "1";

/**
 * 間 (ma) layer, day-2 version: the photo splits into depth layers (FR-29, FR-32) and the
 * Hiroshige print overlays at the anchor-aligned position (FR-31). Camera transition into the
 * painting (FR-33) comes on 11/6.
 */
import { OrbitControls, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import { yearState, type TimelineData } from "@/lib/time-river";
import {
  CAMERA_Z,
  ENTER_MS,
  easeInOut,
  framePlane,
  LAYER_Z,
  artifactRectInPhoto,
  depthCompensation,
  photoWorldSize,
  rectToPlane,
  shouldFall2D,
  type SceneElement,
  type SceneJson,
} from "@/lib/scene";

const LAYER_LABEL: Record<SceneElement["layer"], string> = {
  foreground: "前景",
  midground: "中景",
  background: "背景",
};
const SPLIT_MS = 750; // 6.3: 600–900ms

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function LayerPlane({
  url,
  rect,
  targetZ,
  split,
  reduced,
  opacity = 1,
  renderOrder = 0,
}: {
  url: string;
  rect: { x: number; y: number; w: number; h: number };
  targetZ: number;
  split: number; // timestamp when split started, 0 = flat
  reduced: boolean;
  opacity?: number;
  renderOrder?: number;
}) {
  const tex = useTexture(url, (t) => {
    (Array.isArray(t) ? t : [t]).forEach((x) => (x.colorSpace = THREE.SRGBColorSpace));
  });
  const ref = useRef<THREE.Mesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    const t = split === 0 ? 0 : reduced ? 1 : Math.min(1, (performance.now() - split) / SPLIT_MS);
    const z = targetZ * ease(t);
    const s = depthCompensation(z);
    m.position.set(rect.x * s, rect.y * s, z);
    m.scale.set(rect.w * s, rect.h * s, 1);
    // fade toward the target opacity (time slider), ~600 ms; immediate with reduced motion
    const mm = mat.current;
    if (mm) mm.opacity = reduced ? opacity : mm.opacity + (opacity - mm.opacity) * Math.min(1, dt * 6);
  });
  return (
    <mesh ref={ref} renderOrder={renderOrder}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

type Controls = { target: THREE.Vector3; update: () => void } | null;

/**
 * FR-33: move the camera from the photo into the painting (or back) in ENTER_MS with ease-in-out.
 * Starts from wherever the user left the camera, so the move never jumps.
 */
function CameraRig({
  moving,
  inside,
  frame,
  reduced,
  controls,
  onDone,
}: {
  moving: number; // timestamp when the move started, 0 = idle
  inside: boolean;
  frame: { position: [number, number, number]; target: [number, number, number] } | null;
  reduced: boolean;
  controls: React.RefObject<Controls>;
  onDone: () => void;
}) {
  const { camera } = useThree();
  const from = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  useFrame(() => {
    if (!moving || !frame) return;
    const c = controls.current;
    if (!from.current) from.current = { pos: camera.position.clone(), target: c ? c.target.clone() : new THREE.Vector3() };
    const t = reduced ? 1 : easeInOut((performance.now() - moving) / ENTER_MS);
    const toPos = inside ? new THREE.Vector3(...frame.position) : new THREE.Vector3(0, 0, CAMERA_Z);
    const toTarget = inside ? new THREE.Vector3(...frame.target) : new THREE.Vector3(0, 0, 0);
    camera.position.lerpVectors(from.current.pos, toPos, t);
    const target = new THREE.Vector3().lerpVectors(from.current.target, toTarget, t);
    if (c) {
      c.target.copy(target);
      c.update();
    } else camera.lookAt(target);
    if (t >= 1) {
      from.current = null;
      onDone();
    }
  });
  return null;
}

function AspectProbe({ onAspect }: { onAspect: (a: number) => void }) {
  const { size } = useThree();
  useEffect(() => onAspect(size.width / Math.max(1, size.height)), [size.width, size.height, onAspect]);
  return null;
}

function Fps({ onFps }: { onFps: (n: number) => void }) {
  const acc = useRef({ frames: 0, start: 0 });
  useFrame(() => {
    const a = acc.current;
    const now = performance.now();
    if (a.start === 0) a.start = now;
    a.frames++;
    if (now - a.start >= 1000) {
      onFps(Math.round((a.frames * 1000) / (now - a.start)));
      a.frames = 0;
      a.start = now;
    }
  });
  return null;
}

/** FR-37: the same photo and overlay without WebGL (rect = the print's place in the photo, normalized). */
function Flat2D({ photo, art, rect, overlay, reason, inside = false, onTry3d }: { photo: string; art: string | null; rect: [number, number, number, number] | null; overlay: number; reason: string; inside?: boolean; onTry3d?: () => void }) {
  const why = (
    <p className="flex items-center gap-3 text-caption text-muted">
      {reason}
      {onTry3d && (
        <Button variant="quiet" onClick={onTry3d} data-testid="space-try-3d">
          3Dで見る
        </Button>
      )}
    </p>
  );
  // inside the painting there is only the painting: the whole print, not its place over the photo
  if (inside && art)
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-4" data-testid="space-2d">
        {/* eslint-disable-next-line @next/next/no-img-element -- public-domain print */}
        <img src={art} alt="歌川広重《浅草金龍山》" className="block max-h-[80vh] w-auto rounded-sm" />
        {why}
      </div>
    );
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-4" data-testid="space-2d">
      <div className="relative max-h-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- session-scoped scene photo */}
        <img src={photo} alt="" className="block max-h-[62vh] w-auto rounded-sm" />
        {art && rect && overlay > 0 && (
          // eslint-disable-next-line @next/next/no-img-element -- public-domain print, aligned by anchors
          <img
            src={art}
            alt="歌川広重《浅草金龍山》"
            className="absolute"
            style={{ left: `${rect[0] * 100}%`, top: `${rect[1] * 100}%`, width: `${(rect[2] - rect[0]) * 100}%`, height: `${(rect[3] - rect[1]) * 100}%`, opacity: overlay }}
          />
        )}
      </div>
      {why}
    </div>
  );
}

/** Layers that belong to the permanent gate; they follow the time slider (FR-56). */
const GATE_LAYERS = new Set(["lantern", "lantern_base", "gate"]);
const GATE_OPACITY = { present: 1, absent: 0.06, unknown: 0.35, withheld: 0.35 } as const;

export function SpaceViewer({
  id,
  scene,
  timeline,
  autoEnter = false,
  force2d = false,
  force3d = false,
}: {
  id: string;
  scene: SceneJson;
  timeline?: TimelineData;
  autoEnter?: boolean;
  force2d?: boolean;
  /** ?3d=1: keep 3D even below 30 fps (screenshots on a software renderer) */
  force3d?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const [split, setSplit] = useState(0);
  const [overlay, setOverlay] = useState(0);
  const [year, setYear] = useState(2026);
  const [inside, setInside] = useState(false); // FR-33: inside the painting
  const [moving, setMoving] = useState(0);
  const [opened, setOpened] = useState(0); // the print opened into depth (arrival inside)
  const [aspect, setAspect] = useState(1.6);
  const controls = useRef<Controls>(null);
  const ys = timeline ? yearState(timeline, year) : null;
  const gateOpacity = ys ? GATE_OPACITY[ys.state] : 1;
  // Before the 1866 fire the Kansei-era gate Hiroshige painted stood: open the print automatically.
  const overlayBase = ys && ys.state === "present" && year < 1866 ? Math.max(overlay, 0.85) : overlay;
  const overlayEff = inside ? 1 : overlayBase;
  const photoOpacity = inside ? 0 : 1; // lantern to lantern: the print lands on the photo's lantern and the photo dissolves
  const [fps, setFpsState] = useState(0);
  // FR-37: a device that cannot keep 30 fps (e.g. an older phone) gets the 2D view
  const fpsLog = useRef<number[]>([]);
  const [flat, setFlat] = useState(force2d);
  const [kept3d, setKept3d] = useState(false); // the visitor chose 3D after a fallback: never fall again
  const mountedAt = useRef(0);
  useEffect(() => {
    mountedAt.current = performance.now();
  }, []);
  const setFps = (n: number) => {
    setFpsState(n);
    // heavy moments are not the device's steady speed: loading, the camera move, the print opening, a hidden tab
    const now = performance.now();
    if (document.visibilityState !== "visible" || moving || now - mountedAt.current < 4000 || (opened && now - opened < 2500)) return;
    fpsLog.current.push(n);
    if (!flat && !force3d && !kept3d && shouldFall2D(fpsLog.current, 24, 5)) setFlat(true);
  };
  const [people, setPeople] = useState(1); // FR-36: fade the crowd only
  const hasPeople = Boolean(scene.elements.people);
  const world = useMemo(() => photoWorldSize(scene.size), [scene.size]);
  const file = (f: string) => `/api/cache/scenes/${id}/${f}`;
  const align = scene.alignment?.ok ? scene.alignment : undefined;
  const artRect = useMemo(() => (align ? rectToPlane(artifactRectInPhoto(align), world) : null), [align, world]);
  // The painting plane sits just in front of the foreground and is depth-compensated like the others.
  const artZ = LAYER_Z.foreground + 0.05;
  const artFrame = useMemo(() => {
    if (!artRect) return null;
    const k = depthCompensation(artZ);
    return framePlane({ x: artRect.x * k, y: artRect.y * k, w: artRect.w * k, h: artRect.h * k }, artZ, 30, aspect);
  }, [artRect, artZ, aspect]);
  // the year readout follows what is shown: inside the print it is the print's year
  const go = (into: boolean) => {
    setOpened(0);
    setInside(into);
    setYear(into ? 1856 : 2026);
    setMoving(performance.now());
  };
  // inside the print there is only the print: the panel closes (full screen), the way back stays
  const immersive = inside && !flat && !moving && opened > 0;
  const lang = useLang();
  const l = L[lang];
  const elements = Object.entries(scene.elements).sort((a, b) => LAYER_Z[a[1].layer] - LAYER_Z[b[1].layer]);

  useEffect(() => {
    const t = setTimeout(() => setSplit(performance.now()), 400);
    return () => clearTimeout(t);
  }, []);
  // 「提灯から提灯へ」→ この絵の中へ: arriving with ?enter=1 enters the aligned print after the split
  useEffect(() => {
    if (!autoEnter || !align) return;
    const t = setTimeout(() => {
      setInside(true);
      setYear(1856);
      setMoving(performance.now());
    }, 1800);
    return () => clearTimeout(t);
  }, [autoEnter, align]);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className={`relative flex-1 ${immersive ? "h-dvh" : "h-[70vh] lg:h-auto"}`}>
        {flat ? (
          <Flat2D photo={file(scene.photo)} art={align ? `/api/cache/artifacts/${align.artifact}/image.jpg` : null} rect={align ? artifactRectInPhoto(align) : null} overlay={overlayEff} inside={inside} reason={force2d ? "指定により2D表示" : "この端末では3Dの動きが重いため、2D表示に切り替えました"} onTry3d={force2d ? undefined : () => {
            fpsLog.current = [];
            setKept3d(true);
            setFlat(false);
          }} />
        ) : (
        <Canvas camera={{ position: [0, 0, CAMERA_Z], fov: 30 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <color attach="background" args={["#0e1426"]} />
          <LayerPlane url={file(scene.plate ?? scene.photo)} rect={{ x: 0, y: 0, ...world }} targetZ={0} split={split} reduced={reduced} opacity={photoOpacity} />
          {elements.map(([key, el], i) => (
            <LayerPlane
              key={key}
              url={file(el.png)}
              rect={rectToPlane(el.bbox, world)}
              targetZ={LAYER_Z[el.layer]}
              split={split}
              reduced={reduced}
              opacity={(GATE_LAYERS.has(key) ? gateOpacity : 1) * (key === "people" ? people : 1) * (inside ? 0 : 1)}
              renderOrder={i + 1}
            />
          ))}
          {align && artRect && artFrame && inside && opened > 0 && (
            <PrintDiorama
              camera={artFrame}
              image={`/api/cache/artifacts/${align.artifact}/image.jpg`}
              depth={`/api/cache/artifacts/${align.artifact}/depth.png`}
              rect={{ x: artRect.x * depthCompensation(artZ), y: artRect.y * depthCompensation(artZ), w: artRect.w * depthCompensation(artZ), h: artRect.h * depthCompensation(artZ) }}
              z={artZ}
              opened={opened}
              reduced={reduced}
            />
          )}
          {align && artRect && overlayEff > 0 && !(inside && opened > 0) && (
            <LayerPlane
              url={`/api/cache/artifacts/${align.artifact}/image.jpg`}
              rect={artRect}
              targetZ={LAYER_Z.foreground + 0.05}
              split={split}
              reduced={reduced}
              opacity={overlayEff}
              renderOrder={100}
            />
          )}
          <OrbitControls
            ref={controls as never}
            enabled={!moving && !inside}
            enablePan={false}
            minDistance={0.5}
            maxDistance={8}
          />
          <CameraRig moving={moving} inside={inside} frame={artFrame} reduced={reduced} controls={controls} onDone={() => {
              setMoving(0);
              setOpened(inside ? performance.now() : 0);
            }}
          />
          <AspectProbe onAspect={setAspect} />
          <Fps onFps={setFps} />
        </Canvas>
        )}
        {immersive && (
          <LazyMotion features={domAnimation} strict>
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: reduced ? 0 : 1.2, duration: 0.6 }}
            className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-start justify-between gap-6 bg-gradient-to-b from-night/85 to-transparent px-6 pt-8 pb-24 lg:px-12 lg:pt-10"
            data-testid="space-inside"
          >
            <div className="max-w-[24rem]">
              <p className="label">{l.inside}</p>
              <p className="mt-2 font-serif text-title">{l.print}</p>
              {ys && (
                <p className="mt-2 flex flex-wrap items-center gap-3 font-serif text-body text-paper/85" data-testid="space-year-state" data-state={ys.state}>
                  {ys.label[lang]}
                  <Tag tone={ys.state === "present" ? "toki" : "muted"} dashed={ys.state !== "present"}>
                    {l.state[ys.state]}
                  </Tag>
                </p>
              )}
              <p className="mt-3 text-caption text-muted">{l.how}</p>
            </div>
            <div className="pointer-events-auto flex gap-3">
              <Button variant="secondary" data-testid="enter-painting" disabled={Boolean(moving)} onClick={() => go(false)}>
                {l.back}
              </Button>
            </div>
          </m.div>
          </LazyMotion>
        )}
        {!flat && debugOn() && (
          <p className="pointer-events-none absolute right-3 top-3 rounded-sm bg-night/70 px-2 py-1 text-caption text-muted">
            {fps} fps
          </p>
        )}
      </div>

      {!immersive && (
      <aside className="flex w-full flex-col gap-7 px-6 py-10 lg:w-[24rem] lg:pr-10">
        <BackLink className="-ml-1 mb-1" />
        <h1 className="font-serif text-title">{l.title}</h1>
        <p className="-mt-4 text-caption text-muted">{l.sub}</p>
        {/* 3D-only controls are hidden in the 2D view (FR-37) */}
        {!flat && (
          <div className="flex flex-wrap gap-2">
            {align && (
              <Button variant="primary" data-testid="enter-painting" disabled={Boolean(moving)} onClick={() => go(!inside)}>
                {inside ? l.back : l.enter}
              </Button>
            )}
            <Button variant="quiet" onClick={() => setSplit(split ? 0 : performance.now())}>
              {split ? l.flat : l.split}
            </Button>
          </div>
        )}

        {hasPeople && !flat && (
          <label className="flex flex-col gap-2" data-testid="space-people">
            <span className="flex items-baseline justify-between">
              <span>{l.people}</span>
              <span className="text-small text-muted tabular-nums">{Math.round(people * 100)}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={people}
              onChange={(e) => setPeople(Number(e.target.value))}
              className="min-h-11 accent-[var(--thread-ma)]"
              aria-label={l.peopleAria}
              data-testid="people-slider"
            />
            <span className="text-caption text-muted">{l.peopleNote}</span>
          </label>
        )}

        {timeline && ys && (
          <label className="flex flex-col gap-2" data-testid="space-time">
            <span className="flex items-baseline justify-between">
              <span className="label">{l.time}</span>
              <span className="font-serif text-title tabular-nums">{year}</span>
            </span>
            <input
              type="range"
              min={1750}
              max={2026}
              step={1}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="min-h-11 accent-[var(--thread-toki)]"
              aria-label={l.yearAria}
              data-testid="space-year"
            />
            <span className="flex flex-wrap gap-2">
              {[1856, 1878, 1905, 1960, 2026].map((q) => (
                <button key={q} type="button" onClick={() => setYear(q)} className={`min-h-11 min-w-11 border-b-2 px-1 text-small tabular-nums ${q === year ? "border-paper text-paper" : "border-transparent text-muted hover:text-paper"}`}>
                  {q}
                </button>
              ))}
            </span>
            <span className="font-serif text-lead" data-testid="space-year-state" data-state={ys.state}>
              {ys.label[lang]}
              <span className="ml-2 align-middle font-sans">
                <Tag tone={ys.state === "present" ? "toki" : "muted"} dashed={ys.state !== "present"}>
                  {l.state[ys.state]}
                </Tag>
              </span>
            </span>
          </label>
        )}

        {align && (
          <label className="flex flex-col gap-2">
            <span className="label">{l.overlay}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={overlay}
              onChange={(e) => setOverlay(Number(e.target.value))}
              className="min-h-11 accent-[var(--thread-toki)]"
              aria-label={l.overlayAria}
            />
            <span className="text-small text-muted">
              {overlayBase > overlay ? l.auto : ""}
              {l.anchor}
            </span>
          </label>
        )}

        {/* 6.4: same content as a list */}
        <section>
          <h2 className="label mb-2">{l.layers}</h2>
          <ul className="flex flex-col gap-1 text-small">
            {elements
              .slice()
              .reverse()
              .map(([key, el]) => (
                <li key={key} className="flex justify-between gap-4">
                  <span>{l.name[key] ?? LAYER_JA[key] ?? key}</span>
                  <span className="text-muted">{l.layer[el.layer] ?? LAYER_LABEL[el.layer]}</span>
                </li>
              ))}
          </ul>
        </section>
      </aside>
      )}
    </div>
  );
}
