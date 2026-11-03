"use client";

/**
 * 絵の中へ (FR-33), the moment of arrival: the flat print opens into depth.
 *
 * One mesh; each vertex is pushed back along the ray from the camera by the print's depth map
 * (lantern and pillar near, the snowy approach and the gate far). Along the ray, so from where the
 * camera arrives the print looks exactly like the print — no warping, no wavy edge — and the depth
 * only shows when the camera moves. Then the camera moves: a slow walk toward the gate, a slight
 * sway, and a lean toward the pointer, so the near pillar and lantern slide over the far temple and
 * snow falls between them (as in Hiroshige's 1856 print). The sway is automatic, so a recording
 * without a pointer shows the depth too. Reduced motion: the print opens at once, no snow, no move.
 */
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const SEG_X = 128;
const SEG_Y = 188;
const OPEN_MS = 1400;
/** the farthest point sits this fraction of the camera distance behind the print plane */
const DEPTH_RATIO = 0.75;
/** the walk toward the gate: this fraction of the distance, over WALK_S seconds */
const WALK = 0.16;
const WALK_S = 9;
/** sway and lean, as fractions of the camera distance */
const SWAY = 0.035;
const LEAN = 0.07;
/** where the walk heads, in print coordinates (0..1 from the top-left): the gate down the approach */
const TOWARD = { x: 0.58, y: 0.62 };

/**
 * Read a depth image into a (SEG_X+1) × (SEG_Y+1) grid of 0..1 (1 = near). The outermost cells
 * (the dark rim of the scanned paper) take the value just inside them, so the edge stays straight.
 */
function useDepthGrid(url: string): Float32Array | null {
  const [grid, setGrid] = useState<Float32Array | null>(null);
  useEffect(() => {
    let off = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const W = SEG_X + 1;
      const H = SEG_Y + 1;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.filter = "blur(1.5px)";
      ctx.drawImage(img, 0, 0, W, H);
      const px = ctx.getImageData(0, 0, W, H).data;
      const RIM = 3;
      const g = new Float32Array(W * H);
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const sx = Math.min(W - 1 - RIM, Math.max(RIM, x));
          const sy = Math.min(H - 1 - RIM, Math.max(RIM, y));
          g[y * W + x] = px[(sy * W + sx) * 4] / 255;
        }
      if (!off) setGrid(g);
    };
    img.src = url;
    return () => {
      off = true;
    };
  }, [url]);
  return grid;
}

const easeOut = (t: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeInOut = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};

export function PrintDiorama({
  image,
  depth,
  rect,
  z,
  camera: cam,
  opened,
  reduced,
}: {
  image: string;
  depth: string;
  rect: { x: number; y: number; w: number; h: number };
  z: number;
  /** where the camera arrived (frames the print) */
  camera: { position: [number, number, number]; target: [number, number, number] };
  /** when the camera arrived inside (ms), 0 = not yet */
  opened: number;
  reduced: boolean;
}) {
  const tex = useTexture(image, (t) => {
    (Array.isArray(t) ? t : [t]).forEach((x) => {
      x.colorSpace = THREE.SRGBColorSpace;
      x.anisotropy = 8;
    });
  });
  const grid = useDepthGrid(depth);
  const dist = cam.position[2] - z; // camera distance from the print plane on arrival
  const geo = useMemo(() => new THREE.PlaneGeometry(rect.w, rect.h, SEG_X, SEG_Y), [rect.w, rect.h]);
  const flat = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo]);
  useEffect(() => () => geo.dispose(), [geo]);
  const applied = useRef(-1);
  const base = useMemo(() => new THREE.Vector3(...cam.position), [cam.position]);
  const look = useMemo(() => new THREE.Vector3(...cam.target), [cam.target]);
  // the walk heads for the gate, a point on the far plane
  const goal = useMemo(
    () => new THREE.Vector3(rect.x + (TOWARD.x - 0.5) * rect.w, rect.y + (0.5 - TOWARD.y) * rect.h, z - dist * DEPTH_RATIO),
    [rect, z, dist],
  );
  const pointer = useRef({ x: 0, y: 0 });
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((state, dt) => {
    if (!opened) return;
    const now = performance.now();
    const open = reduced ? 1 : easeOut((now - opened) / OPEN_MS);
    // 1) the print opens: push each vertex back along the camera ray (exact from the arrival point)
    const g = mesh.current?.geometry;
    if (grid && g && applied.current !== open) {
      const pos = g.attributes.position as THREE.BufferAttribute;
      const arr = pos.array as Float32Array;
      const ox = base.x - rect.x;
      const oy = base.y - rect.y;
      for (let i = 0; i < pos.count; i++) {
        const back = (1 - grid[i]) * DEPTH_RATIO * dist * open; // 0 near … DEPTH_RATIO·dist far
        const k = (dist + back) / dist;
        arr[i * 3] = ox + (flat[i * 3] - ox) * k;
        arr[i * 3 + 1] = oy + (flat[i * 3 + 1] - oy) * k;
        arr[i * 3 + 2] = -back;
      }
      pos.needsUpdate = true;
      g.computeBoundingSphere();
      applied.current = open;
    }
    if (reduced) return;
    // 2) the camera walks in, sways, and leans toward the pointer (after the print has opened)
    const t = (now - opened) / 1000;
    const settle = easeOut((now - opened - OPEN_MS * 0.6) / 1200);
    const walk = easeInOut((t - OPEN_MS / 1000) / WALK_S) * WALK * settle;
    const k = Math.min(1, dt * 2.5);
    pointer.current.x += (state.pointer.x - pointer.current.x) * k;
    pointer.current.y += (state.pointer.y - pointer.current.y) * k;
    const sx = (Math.sin(t * 0.42) * SWAY + pointer.current.x * LEAN) * dist * settle;
    const sy = (Math.sin(t * 0.31 + 1.2) * SWAY * 0.45 + pointer.current.y * LEAN * 0.6) * dist * settle;
    state.camera.position.set(base.x + sx, base.y + sy, base.z).lerp(goal, walk);
    state.camera.lookAt(look.clone().lerp(goal, walk * 0.5));
  });

  return (
    <group position={[rect.x, rect.y, z]}>
      <mesh ref={mesh} geometry={geo} renderOrder={101}>
        <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {!reduced && opened > 0 && <Snow w={rect.w * (1 + DEPTH_RATIO)} h={rect.h * (1 + DEPTH_RATIO)} depth={dist * DEPTH_RATIO} opened={opened} />}
    </group>
  );
}

/** Snow between the near and the far: slow, slightly drifting, fading in after the print opens. */
function Snow({ w, h, depth, opened, n = 1600 }: { w: number; h: number; depth: number; opened: number; n?: number }) {
  const pts = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const { positions, speed } = useMemo(() => {
    // deterministic scatter (no Math.random in render): a small LCG
    let seed = 1856;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const p = new Float32Array(n * 3);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const zz = -depth * rnd() + depth * 0.05;
      const spread = 1 + -zz / depth; // farther flakes cover a wider area (the view widens with depth)
      p[i * 3] = (rnd() - 0.5) * w * spread * 0.6;
      p[i * 3 + 1] = (rnd() - 0.5) * h * spread * 0.6;
      p[i * 3 + 2] = zz;
      s[i] = (0.04 + rnd() * 0.08) * h * 0.25;
    }
    return { positions: p, speed: s };
  }, [w, h, depth, n]);
  useFrame((_, dt) => {
    const p = pts.current;
    if (!p) return;
    const a = p.geometry.attributes.position as THREE.BufferAttribute;
    const arr = a.array as Float32Array;
    const time = performance.now() / 1000;
    for (let i = 0; i < n; i++) {
      arr[i * 3 + 1] -= speed[i] * dt;
      arr[i * 3] += Math.sin(time * 0.7 + i) * 0.0004 * h;
      if (arr[i * 3 + 1] < -h * 0.6) arr[i * 3 + 1] = h * 0.6;
    }
    a.needsUpdate = true;
    if (mat.current) mat.current.opacity = Math.min(0.85, Math.max(0, (performance.now() - opened - 600) / 1600) * 0.85);
  });
  return (
    <points ref={pts} renderOrder={102}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} color="#fbf8f1" size={h * 0.006} sizeAttenuation transparent opacity={0} depthWrite={false} />
    </points>
  );
}
