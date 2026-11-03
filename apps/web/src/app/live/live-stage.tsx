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
import { NamesLayer, type NamesData } from "../names-layer";
import type { TimelineData } from "@/lib/time-river";
import { TimeRiver } from "../time-river";
import { Backstage } from "./backstage";
import { StagePanel } from "./stage-panel";
import { Button, ButtonLink } from "../ui/button";
import { Pencil, PencilLegend } from "../ui/marks";
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


export function LiveStage({ source, demoReplay, onExit }: { source: Source; demoReplay?: string | null; onExit?: () => void }) {
  const { state: s, phase, error, expId, photo, elapsed, reduced } = useExploration(source);
  const [view, setView] = useState<"stage" | "list">("stage");
  const [hot, setHot] = useState<string | null>(null);
  const [overlayOn, setOverlayOn] = useState(false);
  const [panel, setPanel] = useState<"backstage" | "time" | "names" | null>(null);
  const toggle = (p: NonNullable<typeof panel>) => setPanel((v) => (v === p ? null : p));
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
        <p className="text-lead" role="alert">
          {error}
        </p>
        {demoReplay && (
          <ButtonLink href={`/replay/${demoReplay}`} variant="primary" data-testid="fallback-replay">
            記録を再生する（録画であることを表示します）
          </ButtonLink>
        )}
        <Link href="/" className="text-small text-muted underline">
          はじめに戻る
        </Link>
      </main>
    );
  }

  const actions = (
    <>
      {s.visual?.hits[0] && s.at.visual !== undefined && (
        <a href={s.visual.hits[0].commons} target="_blank" rel="noreferrer noopener" className="col-span-2 mb-2 flex w-full items-center gap-3" data-testid="visual">
          {/* eslint-disable-next-line @next/next/no-img-element -- public-domain gallery thumbnail */}
          <img src={`/api/cache/visual/images/${s.visual.hits[0].file}`} alt="" className="h-12 w-9 rounded-sm object-cover" />
          <span className="min-w-0">
            <span className="block text-caption text-muted">
              提灯から提灯へ・似た図像 {s.visual.hits[0].score.toFixed(2)} <Pencil />
            </span>
            <span className="block truncate font-serif text-small">{s.visual.hits[0].title}</span>
          </span>
        </a>
      )}
      {s.space?.aligned && s.at.visual !== undefined && (
        <Button variant="quiet" onClick={() => setOverlayOn((v) => !v)} aria-pressed={overlayOn} className="col-span-2 -mt-2 mb-2 w-full justify-start px-0" data-testid="overlay-toggle">
          {overlayOn ? "写真に戻す" : "広重の絵と重ねる"}
        </Button>
      )}
      {finished && expId && (
        <ButtonLink href={`/note/${expId}`} variant="primary" data-testid="note-link">
          旅ノートを開く
        </ButtonLink>
      )}
      {finished && s.timeline != null && (
        <Button onClick={() => toggle("time")} aria-expanded={panel === "time"} data-testid="time-toggle">
          時をめくる
        </Button>
      )}
      {finished && s.names != null && (
        <Button onClick={() => toggle("names")} aria-expanded={panel === "names"} data-testid="names-toggle">
          言の地層
        </Button>
      )}
      {finished && s.space?.ok && s.space.url && (
        <ButtonLink href={`${s.space.url}${s.space.aligned ? "?enter=1" : ""}`} data-testid="space-link">
          {s.space.aligned ? "絵の中へ" : "間（ま）で見る"}
        </ButtonLink>
      )}
      {into && !s.space?.aligned && finished && <ButtonLink href={into}>この絵の中へ</ButtonLink>}
    </>
  );

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <LayoutGroup>
          <main className="flex min-h-dvh w-full max-w-full flex-col gap-4 overflow-x-clip px-4 py-4 lg:h-dvh lg:px-10 lg:py-5">
            <header className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3 border-b border-rule pb-3">
              <div className="flex w-full min-w-0 flex-wrap items-baseline gap-x-10 gap-y-2 lg:w-auto">
                <Link href="/" onClick={onExit} className="font-serif text-lead tracking-[0.3em]" aria-label="TSUMUGI はじめに戻る">
                  TSUMUGI
                </Link>
                <StepRail s={s} elapsed={elapsed} finished={finished} />
              </div>
              <div className="flex items-baseline gap-1">
                <Button variant="quiet" onClick={() => toggle("backstage")} aria-expanded={panel === "backstage"} data-testid="backstage-toggle" disabled={s.calls.length === 0}>
                  舞台裏
                </Button>
                <Button variant="quiet" onClick={() => setView((v) => (v === "stage" ? "list" : "stage"))} className="present-hide" data-testid="view-toggle" disabled={!expId}>
                  {view === "stage" ? "リスト表示" : "舞台表示"}
                </Button>
              </div>
            </header>
            <div className="flex min-h-7 flex-wrap items-center gap-x-6 gap-y-1">
              <LiveChips s={s} finished={finished} replay={replay} />
              {replay && (
                <p className="text-caption text-muted" data-testid="replay-banner">
                  {source.recordedAt.slice(5, 16).replace("-", "/").replace("T", " ")} に実行した探索の録画
                </p>
              )}
              <span className="ml-auto hidden max-w-[40%] lg:block">
                <Toasts s={s} elapsed={elapsed} />
              </span>
            </div>
            {s.failed && (
              <p className="text-small text-ba" role="alert">
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
              <div ref={stageRef} className="relative flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:grid-cols-[minmax(320px,1fr)_auto_96px_minmax(360px,480px)] lg:gap-8">
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
                {panel === "backstage" && <Backstage s={s} onClose={() => setPanel(null)} />}
                {panel === "time" && s.timeline != null && (
                  <StagePanel title={`時をめくる：${s.place?.path[0]?.name.ja ?? ""}はいつ、そこにあったか`} onClose={() => setPanel(null)} testid="time-panel" wide>
                    <TimeRiver data={s.timeline as TimelineData} initialYear={1856} />
                  </StagePanel>
                )}
                {panel === "names" && s.names != null && (
                  <StagePanel title="言の地層：資料ごとの呼び名" onClose={() => setPanel(null)} testid="names-panel" wide>
                    <NamesLayer names={s.names as NamesData} lang="ja" />
                  </StagePanel>
                )}
                <ThreadLayer stageRef={stageRef} anchorRef={anchorRef} axisRef={axisRef} cardEls={cardEls} cards={cards} since={s.at.threads !== undefined ? elapsed - s.at.threads : -1} hot={hot} />
              </div>
            )}

            <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-rule pt-4">
              <ResultStrip s={s} elapsed={elapsed} />
              <PencilLegend />
            </footer>
          </main>
        </LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
