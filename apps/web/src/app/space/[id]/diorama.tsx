"use client";

/**
 * 絵の中へ (FR-33), the moment of arrival: the flat print opens into depth. One mesh, each vertex
 * pushed back by the print's depth map (lantern and pillar near, the snowy approach far), so the
 * surface stays whole — no cut-out layers, no holes to fill. Snow falls through the space between
 * the near and the far, as it does in Hiroshige's 1856 print. The diorama leans a little toward
 * the pointer. Reduced motion: depth shown at once, no snow, no lean.
 */
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

const SEG_X = 128;
const SEG_Y = 188;
const OPEN_MS = 1200;
const DEPTH = 0.55; // world units from the nearest to the farthest point of the print

/** Read a depth image into a SEG_X+1 × SEG_Y+1 grid of 0..1 (1 = near). Downsampling smooths it. */
function useDepthGrid(url: string): Float32Array | null {
  const [grid, setGrid] = useState<Float32Array | null>(null);
  useEffect(() => {
    let off = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = SEG_X + 1;
      c.height = SEG_Y + 1;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.filter = "blur(1px)";
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      const g = new Float32Array(c.width * c.height);
      for (let i = 0; i < g.length; i++) g[i] = px[i * 4] / 255;
      if (!off) setGrid(g);
    };
    img.src = url;
    return () => {
      off = true;
    };
  }, [url]);
  return grid;
}

export function PrintDiorama({
  image,
  depth,
  rect,
  z,
  opened,
  reduced,
}: {
  image: string;
  depth: string;
  rect: { x: number; y: number; w: number; h: number };
  z: number;
  /** when the camera arrived inside (ms), 0 = not yet */
  opened: number;
  reduced: boolean;
}) {
  const tex = useTexture(image, (t) => {
    (Array.isArray(t) ? t : [t]).forEach((x) => (x.colorSpace = THREE.SRGBColorSpace));
  });
  const grid = useDepthGrid(depth);
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1, SEG_X, SEG_Y);
    if (grid) {
      const pos = g.attributes.position as THREE.BufferAttribute;
      // PlaneGeometry vertices run row by row from the top-left, the same order as the image grid
      for (let i = 0; i < pos.count; i++) pos.setZ(i, grid[i] - 1); // near = 0, far = -1
      pos.needsUpdate = true;
    }
    return g;
  }, [grid]);
  useEffect(() => () => geo.dispose(), [geo]);
  const group = useRef<THREE.Group>(null);
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((state, dt) => {
    const m = mesh.current;
    const gr = group.current;
    if (!m || !gr) return;
    const t = !opened ? 0 : reduced ? 1 : Math.min(1, (performance.now() - opened) / OPEN_MS);
    const e = 1 - Math.pow(1 - t, 3);
    m.scale.set(rect.w, rect.h, DEPTH * e);
    if (!reduced) {
      // lean toward the pointer, softly
      const k = Math.min(1, dt * 3);
      gr.rotation.y += (state.pointer.x * 0.14 * e - gr.rotation.y) * k;
      gr.rotation.x += (-state.pointer.y * 0.09 * e - gr.rotation.x) * k;
    }
  });
  return (
    <group ref={group} position={[rect.x, rect.y, z]}>
      <mesh ref={mesh} geometry={geo} renderOrder={101}>
        <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
      {!reduced && opened > 0 && <Snow w={rect.w} h={rect.h} depth={DEPTH} opened={opened} />}
    </group>
  );
}

/** Snow between the near and the far: slow, slightly drifting, fading in after the print opens. */
function Snow({ w, h, depth, opened, n = 1200 }: { w: number; h: number; depth: number; opened: number; n?: number }) {
  const pts = useRef<THREE.Points>(null);
  const mat = useRef<THREE.PointsMaterial>(null);
  const { positions, speed } = useMemo(() => {
    // deterministic scatter (no Math.random in render): a small LCG
    let seed = 1856;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const p = new Float32Array(n * 3);
    const s = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      p[i * 3] = (rnd() - 0.5) * w;
      p[i * 3 + 1] = (rnd() - 0.5) * h;
      p[i * 3 + 2] = -depth * rnd() + 0.08;
      s[i] = 0.05 + rnd() * 0.09;
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
      arr[i * 3] += Math.sin(time * 0.7 + i) * 0.0004;
      if (arr[i * 3 + 1] < -h / 2) arr[i * 3 + 1] = h / 2;
    }
    a.needsUpdate = true;
    if (mat.current) mat.current.opacity = Math.min(0.85, ((performance.now() - opened) / 1600) * 0.85);
  });
  return (
    <points ref={pts} renderOrder={102}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={mat} color="#fbf8f1" size={0.012} sizeAttenuation transparent opacity={0} depthWrite={false} />
    </points>
  );
}
