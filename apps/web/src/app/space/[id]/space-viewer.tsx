"use client";

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

/** Layers that belong to the permanent gate; they follow the time slider (FR-56). */
const GATE_LAYERS = new Set(["lantern", "lantern_base", "gate"]);
const GATE_OPACITY = { present: 1, absent: 0.06, unknown: 0.35, withheld: 0.35 } as const;
const STATE_JA = { present: "あった", absent: "不在", unknown: "確認待ち", withheld: "判定保留" } as const;

export function SpaceViewer({ id, scene, timeline, autoEnter = false }: { id: string; scene: SceneJson; timeline?: TimelineData; autoEnter?: boolean }) {
  const reduced = usePrefersReducedMotion();
  const [split, setSplit] = useState(0);
  const [overlay, setOverlay] = useState(0);
  const [year, setYear] = useState(2026);
  const [inside, setInside] = useState(false); // FR-33: inside the painting
  const [moving, setMoving] = useState(0);
  const [aspect, setAspect] = useState(1.6);
  const controls = useRef<Controls>(null);
  const ys = timeline ? yearState(timeline, year) : null;
  const gateOpacity = ys ? GATE_OPACITY[ys.state] : 1;
  // Before the 1866 fire the Kansei-era gate Hiroshige painted stood: open the print automatically.
  const overlayBase = ys && ys.state === "present" && year < 1866 ? Math.max(overlay, 0.85) : overlay;
  const overlayEff = inside ? 1 : overlayBase;
  const photoOpacity = inside ? 0 : 1; // the photo dissolves as we enter the painting
  const [fps, setFps] = useState(0);
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
  const go = (into: boolean) => {
    setInside(into);
    setMoving(performance.now());
  };
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
      setMoving(performance.now());
    }, 1800);
    return () => clearTimeout(t);
  }, [autoEnter, align]);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="relative h-[70vh] flex-1 lg:h-auto">
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
              opacity={(GATE_LAYERS.has(key) ? gateOpacity : 1) * photoOpacity}
              renderOrder={i + 1}
            />
          ))}
          {align && artRect && overlayEff > 0 && (
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
            enabled={!moving}
            enablePan={false}
            minDistance={0.5}
            maxDistance={8}
          />
          <CameraRig moving={moving} inside={inside} frame={artFrame} reduced={reduced} controls={controls} onDone={() => setMoving(0)} />
          <AspectProbe onAspect={setAspect} />
          <Fps onFps={setFps} />
        </Canvas>
        <p className="pointer-events-none absolute right-3 top-3 rounded bg-night/70 px-2 py-1 text-xs text-muted">
          {fps} fps
        </p>
      </div>

      <aside className="flex w-full flex-col gap-6 p-6 lg:w-96">
        <h1 className="font-serif text-3xl">間（ま）</h1>
        <button
          type="button"
          className="min-h-11 rounded-full border border-ma px-5 text-ma"
          onClick={() => setSplit(split ? 0 : performance.now())}
        >
          {split ? "平面に戻す" : "層に割る"}
        </button>

        {align && (
          <button
            type="button"
            data-testid="enter-painting"
            disabled={Boolean(moving)}
            onClick={() => go(!inside)}
            className="min-h-11 rounded-full bg-toki px-5 font-bold text-night disabled:opacity-50"
          >
            {inside ? "今へ戻る" : "絵の中へ（広重 1856）"}
          </button>
        )}

        {timeline && ys && (
          <label className="flex flex-col gap-2" data-testid="space-time">
            <span className="flex items-baseline justify-between">
              <span>時をめくる</span>
              <span className="font-serif text-3xl tabular-nums">{year}</span>
            </span>
            <input
              type="range"
              min={1750}
              max={2026}
              step={1}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="min-h-11 accent-[var(--thread-toki)]"
              aria-label="年を選ぶ"
              data-testid="space-year"
            />
            <span className="flex flex-wrap gap-2">
              {[1856, 1878, 1905, 1960, 2026].map((q) => (
                <button key={q} type="button" onClick={() => setYear(q)} className="min-h-11 rounded-full border border-muted/50 px-3 text-sm tabular-nums">
                  {q}
                </button>
              ))}
            </span>
            <span className="text-sm" data-testid="space-year-state" data-state={ys.state}>
              [{STATE_JA[ys.state]}] {ys.label.ja}
            </span>
          </label>
        )}

        {align && (
          <label className="flex flex-col gap-2">
            <span>
              重ねる：歌川広重《浅草金龍山》1856 <span className="text-muted">（The Met 56689）</span>
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={overlay}
              onChange={(e) => setOverlay(Number(e.target.value))}
              className="min-h-11 accent-[var(--thread-toki)]"
              aria-label="広重の絵を重ねる割合"
            />
            <span className="text-sm text-muted">
              {overlayBase > overlay ? "1866年の焼失より前は、広重が描いた門の時代として自動で重ねています。" : ""}
              位置合わせ：大提灯の下端と左端（資料側のアンカーは事前注記：{align.artifact_anchors_annotated_by}）
            </span>
          </label>
        )}

        {/* 6.4: same content as a list */}
        <section>
          <h2 className="mb-2 text-lg">層の一覧</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {elements
              .slice()
              .reverse()
              .map(([key, el]) => (
                <li key={key} className="flex justify-between gap-4">
                  <span>{key}</span>
                  <span className="text-muted">
                    {LAYER_LABEL[el.layer]} · 深度 {el.depth.toFixed(2)} · score {el.score.toFixed(2)}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}
