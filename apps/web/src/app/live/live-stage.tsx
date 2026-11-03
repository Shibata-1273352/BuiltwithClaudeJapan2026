"use client";

/**
 * The live stage (6.2, desktop 1920×1080 first; phone stacks): text | photo | year axis | evidence,
 * threads drawn across all of them. Every SSE event visibly changes something while the AI works.
 * "リスト表示" (6.4) shows the same running exploration as the accessible list.
 */
import Link from "next/link";
import { domMax, LazyMotion, LayoutGroup, MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sourceCards } from "@/lib/live/state";
import { ExplorationView } from "../exploration-view";
import { EvidenceColumn } from "./evidence-column";
import { PhotoStage, useScene } from "./photo-stage";
import { LiveChips, ResultStrip, StepRail, Toasts } from "./stage-chrome";
import { TextColumn } from "./text-column";
import { ThreadLayer } from "./thread-layer";
import { useExploration, type Source } from "./use-exploration";
import { YearAxis } from "./year-axis";

function usePresent() {
  useEffect(() => {
    const html = document.documentElement;
    if (new URLSearchParams(location.search).get("present") === "1") html.dataset.present = "1";
    const on = (e: KeyboardEvent) => {
      if (e.key !== "p" && e.key !== "P") return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (html.dataset.present) delete html.dataset.present;
      else html.dataset.present = "1";
    };
    window.addEventListener("keydown", on);
    return () => {
      window.removeEventListener("keydown", on);
      delete html.dataset.present;
    };
  }, []);
}

const btn = "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium";

export function LiveStage({ source, demoReplay, onExit }: { source: Source; demoReplay?: string | null; onExit?: () => void }) {
  const { state: s, phase, error, expId, photo, elapsed, reduced } = useExploration(source);
  const [view, setView] = useState<"stage" | "list">("stage");
  const [hot, setHot] = useState<string | null>(null);
  const [overlayOn, setOverlayOn] = useState(false);
  const [aspect, setAspect] = useState(3 / 4);
  const stageRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const axisRef = useRef<HTMLDivElement>(null);
  const cardEls = useRef(new Map<string, HTMLElement>());
  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) cardEls.current.set(id, el);
      else cardEls.current.delete(id);
    },
    [],
  );
  usePresent();
  const scene = useScene(s.space?.ok ? s.space.scene_id : undefined);
  const cards = useMemo(() => sourceCards(s), [s]);
  const finished = phase === "done";
  const replay = source.kind === "replay";
  const photoUrl = photo ?? (s.space?.scene_id ? `/api/cache/scenes/${s.space.scene_id}/photo.jpg` : null);
  const into = s.visual?.hits.find((h) => h.into)?.into;

  if (phase === "refused") {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-lg" role="alert">
          {error}
        </p>
        {demoReplay && (
          <a href={`/replay/${demoReplay}`} className={`${btn} bg-koto text-night`} data-testid="fallback-replay">
            記録を再生する（録画であることを表示します）
          </a>
        )}
        <Link href="/" className="text-sm text-muted underline">
          はじめに戻る
        </Link>
      </main>
    );
  }

  const actions = (
    <>
      {s.visual?.hits[0] && s.at.visual !== undefined && (
        <a href={s.visual.hits[0].commons} target="_blank" rel="noreferrer noopener" className="flex w-full items-center gap-3 rounded-lg bg-night-2/80 p-2 ring-1 ring-muted/15" data-testid="visual">
          {/* eslint-disable-next-line @next/next/no-img-element -- public-domain gallery thumbnail */}
          <img src={`/api/cache/visual/images/${s.visual.hits[0].file}`} alt="" className="h-14 w-10 rounded object-cover" />
          <span className="min-w-0 text-xs leading-snug">
            <span className="block text-muted">提灯から提灯へ：似た図像（類似度 {s.visual.hits[0].score.toFixed(2)}。根拠ではありません）</span>
            <span className="block truncate font-serif text-sm">{s.visual.hits[0].title}</span>
          </span>
        </a>
      )}
      {finished && expId && (
        <a href={`/note/${expId}`} className={`${btn} bg-lantern text-night`} data-testid="note-link">
          旅ノートを開く
        </a>
      )}
      {finished && s.space?.ok && s.space.url && (
        <a href={`${s.space.url}${s.space.aligned ? "?enter=1" : ""}`} className={`${btn} border border-ma text-paper`} data-testid="space-link">
          間（ま）で見る{s.space.aligned ? "・絵の中へ" : ""}
        </a>
      )}
      {into && !s.space?.aligned && finished && (
        <a href={into} className={`${btn} bg-toki text-night`}>
          この絵の中へ
        </a>
      )}
      {s.space?.aligned && s.at.visual !== undefined && (
        <button type="button" onClick={() => setOverlayOn((v) => !v)} className={`${btn} border border-toki/60`} aria-pressed={overlayOn} data-testid="overlay-toggle">
          {overlayOn ? "写真に戻す" : "広重の絵と重ねる"}
        </button>
      )}
    </>
  );

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <LayoutGroup>
          <main className="flex min-h-dvh flex-col gap-3 px-4 py-3 lg:h-dvh lg:px-8 lg:py-4">
            <header className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <Link href="/" onClick={onExit} className="font-serif text-xl tracking-[0.3em]" aria-label="TSUMUGI はじめに戻る">
                  TSUMUGI
                </Link>
                <StepRail s={s} elapsed={elapsed} finished={finished} />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setView((v) => (v === "stage" ? "list" : "stage"))} className="present-hide min-h-9 rounded-full border border-muted/40 px-3 text-xs" data-testid="view-toggle" disabled={!expId}>
                  {view === "stage" ? "リスト表示" : "舞台表示"}
                </button>
              </div>
            </header>
            <div className="flex min-h-8 flex-wrap items-center gap-3">
              <LiveChips s={s} finished={finished} replay={replay} />
              {replay && (
                <p className="text-xs text-koto" data-testid="replay-banner">
                  これは記録の再生です（{source.recordedAt.slice(0, 16).replace("T", " ")} に実行した探索）。新しい探索は行っていません。
                </p>
              )}
            </div>
            {s.failed && (
              <p className="text-sm text-ba" role="alert">
                探索を最後まで進められませんでした：{s.failed.message}
                {demoReplay && (
                  <a href={`/replay/${demoReplay}`} className="ml-3 underline" data-testid="fallback-replay">
                    記録を再生する（録画）
                  </a>
                )}
              </p>
            )}

            {view === "list" && expId ? (
              <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto">
                <ExplorationView attach={replay ? undefined : expId} replay={replay ? { explorationId: expId, recordedAt: source.recordedAt } : undefined} />
              </div>
            ) : (
              <div ref={stageRef} className="relative flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(320px,1fr)_auto_104px_minmax(360px,500px)] lg:gap-5">
                <div className="order-2 min-h-0 lg:order-none">
                  <TextColumn s={s} cards={cards} elapsed={elapsed} reduced={reduced} hot={hot} setHot={setHot} actions={actions} />
                </div>
                <div className="order-1 flex h-[45vh] min-h-0 justify-center lg:order-none lg:h-full">
                  <PhotoStage s={s} photo={photoUrl} elapsed={elapsed} scene={scene} anchorRef={anchorRef} overlayOn={overlayOn} onAspect={setAspect} aspect={aspect} />
                </div>
                <div className="hidden min-h-0 lg:block">
                  <YearAxis s={s} cards={cards} axisRef={axisRef} />
                </div>
                <div className="order-3 min-h-0 lg:order-none">
                  <EvidenceColumn s={s} cards={cards} register={register} hot={hot} setHot={setHot} />
                </div>
                <ThreadLayer stageRef={stageRef} anchorRef={anchorRef} axisRef={axisRef} cardEls={cardEls} cards={cards} since={s.at.threads !== undefined ? elapsed - s.at.threads : -1} hot={hot} />
              </div>
            )}

            <footer className="border-t border-muted/20 pt-3">
              <ResultStrip s={s} elapsed={elapsed} />
            </footer>
            <Toasts s={s} elapsed={elapsed} />
          </main>
        </LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
