"use client";

/**
 * FR-35 視点の見立て (pencil): where you stand and where Hiroshige stood, as directions with their
 * premises. A qualitative guess — not geometry, not evidence — drawn as a faint dashed arrow.
 */
import { m } from "motion/react";
import type { LiveState } from "@/lib/live/state";
import { dict, useDict, useLang } from "../i18n";
import { Pencil } from "../ui/marks";

const ANGLE: Record<string, number> = { north: 0, northeast: 45, east: 90, southeast: 135, south: 180, southwest: 225, west: 270, northwest: 315 };
export const FACING: Record<"ja" | "en", Record<string, string>> = {
  ja: { north: "北", northeast: "北東", east: "東", southeast: "南東", south: "南", southwest: "南西", west: "西", northwest: "北西", up: "上（見上げる）", unknown: "不明" },
  en: { north: "north", northeast: "northeast", east: "east", southeast: "southeast", south: "south", southwest: "southwest", west: "west", northwest: "northwest", up: "up", unknown: "unknown" },
};
/** kept for callers that only show Japanese */
export const FACING_JA = FACING.ja;

const T = dict({
  ja: { faces: (who: string, f: string) => `${who}：${f}を向く`, n: "北", title: "視点の見立て", you: "あなた", hiroshige: "広重", facing: (f: string) => `${f}を向く`, from: (p: string, t: string) => `${p}から、${t}`, premises: "前提（Claude）：", premisesArt: "前提：", note: (a: string) => `（注記 ${a}）`, sep: "／" },
  en: { faces: (who: string, f: string) => `${who}: facing ${f}`, n: "N", title: "Where you stand", you: "You", hiroshige: "Hiroshige", facing: (f: string) => `face ${f}`, from: (p: string, t: string) => `from ${p}, toward ${t}`, premises: "Assuming (Claude): ", premisesArt: "Assuming: ", note: (a: string) => ` (noted by ${a})`, sep: " / " },
});


function Compass({ facing, color, label }: { facing: string; color: string; label: string }) {
  const a = ANGLE[facing];
  const t = useDict(T);
  const lang = useLang();
  return (
    <svg viewBox="-24 -24 48 48" className="size-12 shrink-0" role="img" aria-label={t.faces(label, FACING[lang][facing] ?? facing)}>
      <circle r={20} fill="none" stroke="var(--muted)" strokeOpacity={0.35} strokeDasharray="2 3" />
      <text y={-12} textAnchor="middle" fontSize={7} fill="var(--muted)">
        {t.n}
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
  return <ViewpointBody v={v} art={art} />;
}

function ViewpointBody({ v, art }: { v: NonNullable<LiveState["viewpoint"]>; art: NonNullable<LiveState["viewpoint"]>["artwork"] }) {
  const t = useDict(T);
  const lang = useLang();
  const f = (x: string) => FACING[lang][x] ?? x;
  return (
    <m.section initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="viewpoint" aria-label={t.title}>
      <p className="label">
        {t.title} <Pencil />
      </p>
      <div className="mt-2 flex flex-col gap-3">
        {v.visitor && (
          <div className="flex gap-3">
            <Compass facing={v.visitor.facing} color="var(--paper)" label={t.you} />
            <div className="min-w-0">
              <p className="text-small">
                <span className="font-medium">{t.you}</span> {t.facing(f(v.visitor.facing))} ── {t.from(v.visitor.position[lang], v.visitor.toward[lang])}
              </p>
              <p className="mt-0.5 text-caption text-muted">{t.premises}{v.visitor.premises.map((p) => p[lang]).join(t.sep)}</p>
            </div>
          </div>
        )}
        {art && (
          <div className="flex gap-3">
            <Compass facing={art.facing} color="var(--thread-toki)" label={t.hiroshige} />
            <div className="min-w-0">
              <p className="text-small">
                <span className="font-medium text-toki">{t.hiroshige}</span> {t.facing(f(art.facing))} ── {art[lang]}
              </p>
              <p className="mt-0.5 text-caption text-muted">
                {t.premisesArt}
                {art.premises.map((p) => p[lang]).join(t.sep)}
                {t.note(art.annotated_by)}
              </p>
            </div>
          </div>
        )}
      </div>
    </m.section>
  );
}
