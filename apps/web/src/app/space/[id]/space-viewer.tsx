"use client";

/**
 * 間 (ma) layer, day-2 version: the photo splits into depth layers (FR-29, FR-32) and the
 * Hiroshige print overlays at the anchor-aligned position (FR-31). Camera transition into the
 * painting (FR-33) comes on 11/6.
 */
import { OrbitControls, useTexture } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import * as THREE from "three";
import {
  CAMERA_Z,
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
  useFrame(() => {
    const m = ref.current;
    if (!m) return;
    const t = split === 0 ? 0 : reduced ? 1 : Math.min(1, (performance.now() - split) / SPLIT_MS);
    const z = targetZ * ease(t);
    const s = depthCompensation(z);
    m.position.set(rect.x * s, rect.y * s, z);
    m.scale.set(rect.w * s, rect.h * s, 1);
  });
  return (
    <mesh ref={ref} renderOrder={renderOrder}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={tex} transparent opacity={opacity} depthWrite={false} toneMapped={false} />
    </mesh>
  );
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

export function SpaceViewer({ id, scene }: { id: string; scene: SceneJson }) {
  const reduced = usePrefersReducedMotion();
  const [split, setSplit] = useState(0);
  const [overlay, setOverlay] = useState(0);
  const [fps, setFps] = useState(0);
  const world = useMemo(() => photoWorldSize(scene.size), [scene.size]);
  const file = (f: string) => `/api/cache/scenes/${id}/${f}`;
  const align = scene.alignment?.ok ? scene.alignment : undefined;
  const artRect = useMemo(() => (align ? rectToPlane(artifactRectInPhoto(align), world) : null), [align, world]);
  const elements = Object.entries(scene.elements).sort((a, b) => LAYER_Z[a[1].layer] - LAYER_Z[b[1].layer]);

  useEffect(() => {
    const t = setTimeout(() => setSplit(performance.now()), 400);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex flex-1 flex-col lg:flex-row">
      <div className="relative h-[70vh] flex-1 lg:h-auto">
        <Canvas camera={{ position: [0, 0, CAMERA_Z], fov: 30 }} dpr={[1, 2]} gl={{ antialias: true }}>
          <color attach="background" args={["#0e1426"]} />
          <LayerPlane url={file(scene.plate ?? scene.photo)} rect={{ x: 0, y: 0, ...world }} targetZ={0} split={split} reduced={reduced} />
          {elements.map(([key, el], i) => (
            <LayerPlane
              key={key}
              url={file(el.png)}
              rect={rectToPlane(el.bbox, world)}
              targetZ={LAYER_Z[el.layer]}
              split={split}
              reduced={reduced}
              renderOrder={i + 1}
            />
          ))}
          {align && artRect && overlay > 0 && (
            <LayerPlane
              url={`/api/cache/artifacts/${align.artifact}/image.jpg`}
              rect={artRect}
              targetZ={LAYER_Z.foreground + 0.05}
              split={split}
              reduced={reduced}
              opacity={overlay}
              renderOrder={100}
            />
          )}
          <OrbitControls enablePan={false} minDistance={1.5} maxDistance={8} />
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
