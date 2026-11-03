/**
 * The design rules of CLAUDE.md, checked on the source (so the look does not drift back).
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.join(import.meta.dirname, "app");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(f) ? [p] : [];
  });
}
const all = files(APP).map((p) => ({ p: path.relative(APP, p), s: readFileSync(p, "utf8") }));
const outsideUi = all.filter((f) => !f.p.startsWith("ui/"));

function hits(list: typeof all, re: RegExp) {
  return list.flatMap((f) => [...f.s.matchAll(new RegExp(re, "g"))].map((m) => `${f.p}: ${m[0]}`));
}

describe("design rules (CLAUDE.md)", () => {
  it("1. type scale only: no Tailwind default sizes, no arbitrary sizes", () => {
    expect(hits(all, /\btext-(xs|sm|base|lg|xl|[2-9]xl)\b/)).toEqual([]);
    expect(hits(all, /\btext-\[[0-9.]+(px|rem|em)\]/)).toEqual([]);
  });
  it("3. two radii; rounded-full only in ui/", () => {
    expect(hits(outsideUi, /\brounded-(full|lg|xl|2xl|3xl)\b/)).toEqual([]);
    expect(hits(all, /\brounded(?=["\s`])/)).toEqual([]);
  });
  it("4. no glow or colored shadow outside the threads and the lifted cut-outs; no blur", () => {
    const glowOk = new Set(["live/rope-layer.tsx", "live/objects-layer.tsx", "live/photo-stage.tsx"]); // threads, lifted cut-outs
    expect(hits(all.filter((f) => !glowOk.has(f.p)), /\bglow\b|shadow-\[0_0|drop-shadow/)).toEqual([]);
    expect(hits(all, /backdrop-blur/)).toEqual([]);
  });
  it("5. the disclaimer is said once", () => {
    expect(hits(all, /根拠ではありません/).length).toBeLessThanOrEqual(1);
  });
});
