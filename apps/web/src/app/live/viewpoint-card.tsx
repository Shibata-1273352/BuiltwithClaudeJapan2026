"use client";

/**
 * FR-35 視点の見立て (pencil): where you stand and where Hiroshige stood, as directions with their
 * premises. A qualitative guess — not geometry, not evidence — drawn as a faint dashed arrow.
 */
import { m } from "motion/react";
import type { LiveState } from "@/lib/live/state";

const ANGLE: Record<string, number> = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
const FACING_JA: Record<string, string> = {
  north: "北",
  northeast: "北東",
  east: "東",
  southeast: "南東",
  south: "南",
  southwest: "南西",
  west: "西",
  northwest: "北西",
  up: "上（見上げる）",
  unknown: "不明",
};

function Compass({ facing, color, label }: { facing: string; color: string; label: string }) {
  const a = ANGLE[facing];
  return (
    <svg viewBox="-24 -24 48 48" className="size-12 shrink-0" role="img" aria-label={`${label}：${FACING_JA[facing] ?? facing}を向く`}>
      <circle r={20} fill="none" stroke="var(--muted)" strokeOpacity={0.35} strokeDasharray="2 3" />
      <text y={-12} textAnchor="middle" fontSize={7} fill="var(--muted)">
        北
      </text>
      {a !== undefined ? (
        <m.g initial={{ rotate: a - 60, opacity: 0 }} animate={{ rotate: a, opacity: 1 }} transition={{ duration: 0.9, ease: "easeOut" }}>
          <path d="M 0 10 L 0 -15 M -4 -10 L 0 -15 L 4 -10" fill="none" stroke={color} strokeWidth={1.6} strokeDasharray="3 2" strokeLinecap="round" />
        </m.g>
      ) : facing === "up" ? (
        <circle r={5} fill="none" stroke={color} strokeWidth={1.6} strokeDasharray="3 2" />
      ) : null}
    </svg>
  );
}

export function ViewpointCard({ s }: { s: LiveState }) {
  const v = s.viewpoint;
  if (!v || (!v.visitor && !v.artwork)) return null;
  // Hiroshige's side only once the print has actually been aligned to this photo
  const art = s.space?.aligned ? v.artwork : null;
  return (
    <m.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-dashed border-muted/50 p-3" data-testid="viewpoint" aria-label="視点の見立て">
      <p className="text-xs text-muted">
        <span className="font-hand text-paper">視点の見立て</span>（鉛筆：構図からの解釈。根拠ではありません）
      </p>
      {v.visitor && (
        <div className="mt-2 flex gap-3">
          <Compass facing={v.visitor.facing} color="var(--lantern)" label="あなた" />
          <div className="min-w-0 text-sm">
            <p>
              <span className="text-lantern">あなた</span>：{v.visitor.position.ja}から、{v.visitor.toward.ja}（{FACING_JA[v.visitor.facing] ?? v.visitor.facing}）
            </p>
            <p className="mt-0.5 text-xs text-muted">前提（Claude）：{v.visitor.premises.map((p) => p.ja).join("／")}</p>
          </div>
        </div>
      )}
      {art && (
        <div className="mt-2 flex gap-3">
          <Compass facing={art.facing} color="var(--thread-toki)" label="広重" />
          <div className="min-w-0 text-sm">
            <p>
              <span className="text-toki">広重</span>：{art.ja}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              前提：{art.premises.map((p) => p.ja).join("／")}（注記：{art.annotated_by}）
            </p>
          </div>
        </div>
      )}
    </m.section>
  );
}
