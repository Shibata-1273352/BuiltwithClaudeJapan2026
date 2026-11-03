/**
 * Small marks (CLAUDE.md design 2–5): Section (caption label over a hairline), Tag, StatusDot,
 * and the one pencil marker + legend that replaces repeated disclaimers.
 */
import type { ReactNode } from "react";

export function Section({ label, aside, children, className = "", ...rest }: { label: ReactNode; aside?: ReactNode; children: ReactNode; className?: string } & Record<`data-${string}`, string> & { "aria-label"?: string }) {
  return (
    <section className={`border-t border-rule pt-3 ${className}`} {...rest}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="label">{label}</h2>
        {aside && <span className="text-caption text-muted tabular-nums">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

export function Tag({ children, tone = "muted", dashed = false }: { children: ReactNode; tone?: "muted" | "paper" | "toki" | "ba" | "koto" | "ma" | "lantern"; dashed?: boolean }) {
  const color = { muted: "text-muted", paper: "text-paper", toki: "text-toki", ba: "text-ba", koto: "text-koto", ma: "text-ma", lantern: "text-lantern" }[tone];
  return <span className={`inline-flex items-center rounded-sm border px-1.5 text-caption leading-5 ${dashed ? "border-dashed" : ""} border-current/40 ${color}`}>{children}</span>;
}

export function StatusDot({ tone = "muted", pulse = false }: { tone?: "muted" | "lantern" | "toki" | "ba" | "koto"; pulse?: boolean }) {
  const bg = { muted: "bg-muted/50", lantern: "bg-lantern", toki: "bg-toki", ba: "bg-ba", koto: "bg-koto" }[tone];
  return <span aria-hidden className={`inline-block size-1.5 shrink-0 rounded-full ${bg} ${pulse ? "animate-pulse" : ""}`} />;
}

/** 鉛筆: an interpretation, a similarity or an association — never evidence (6.1 line style). */
export function Pencil({ children = "鉛筆" }: { children?: ReactNode }) {
  return <span className="font-hand text-small text-muted underline decoration-dashed decoration-muted/70 underline-offset-4">{children}</span>;
}

/** A data point (year axis, timeline): round by meaning, so it lives here with the other round marks. */
export function Dot({ className = "", style, title }: { className?: string; style?: React.CSSProperties; title?: string }) {
  return <span aria-hidden={!title} title={title} className={`rounded-full ${className}`} style={style} />;
}

export function PencilLegend() {
  return (
    <p className="text-caption text-muted" data-testid="pencil-legend">
      <Pencil /> は解釈・類似・連想。根拠ではありません。
    </p>
  );
}
