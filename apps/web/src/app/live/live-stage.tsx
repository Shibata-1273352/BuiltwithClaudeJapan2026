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
import { Pencil } from "../ui/marks";
import { LoomLegend } from "../ui/legend";
import { EvidenceColumn } from "./evidence-column";
import { PhotoStage, useScene } from "./photo-stage";
import { LiveChips, ResultStrip, StepRail, Toasts } from "./stage-chrome";
import { TextColumn } from "./text-column";
import { RopeLayer, type RopeSpec } from "./rope-layer";
import { ObjectsLayer } from "./objects-layer";
import { GuideCards } from "./guide-cards";
import { LAYER_COLOR } from "./labels";
import { loomObjects } from "@/lib/live/objects";
import { pluck } from "@/lib/live/feel";
import { yearState, type TimelineData as RiverData } from "@/lib/time-river";
import { useLang } from "../i18n";
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
  const axisRef = useRef<HTMLDivElement>(null);
  // every end a thread can tie to: obj:<key>, guide:<see index>, card:<source id>
  const anchors = useRef(new Map<string, HTMLElement>());
  const register = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) anchors.current.set(id, el);
      else anchors.current.delete(id);
    },
    [],
  );
  const registerCard = useCallback((id: string) => register(`card:${id}`), [register]);
  const pluckRef = useRef<(objKey: string) => number>(() => 0);
  const [selectedObj, setSelectedObj] = useState<string | null>(null);
  const [scrub, setScrub] = useState<number | null>(null);
  const lang = useLang();
  const lastDecade = useRef<number | null>(null);
  usePresent();
  const scene = useScene(s.space?.ok ? s.space.scene_id : undefined);
  const cards = useMemo(() => sourceCards(s), [s]);
  const seeEls = s.see?.elements ?? s.seeProgress?.elements;
  const objects = useMemo(() => loomObjects(scene?.elements ?? null, seeEls ?? []), [scene, seeEls]);
  const mainObj = objects.find((o) => o.key === "lantern") ?? objects.find((o) => o.png) ?? objects[0];
  const selectedSee = objects.find((o) => o.key === selectedObj)?.seeIndex ?? null;
  // touching an object plucks its threads: they swing, a note sounds, the device ticks
  const onTouch = useCallback((key: string) => {
    const len = pluckRef.current(key);
    pluck(len || 300);
  }, []);
  // turning the years (FR-56 on the stage): the structure vanishes in an absent year, the print returns before the fire
  const ys = scrub !== null && s.timeline ? yearState(s.timeline as RiverData, scrub) : null;
  const absentNow = ys?.state === "absent";
  const onScrub = useCallback((y: number) => {
    setScrub(y);
    const d = Math.floor(y / 10);
    if (lastDecade.current !== d) {
      lastDecade.current = d;
      pluck(260 + (y - 1750));
    }
  }, []);
  const onSelectSee = useCallback((i: number) => setSelectedObj(objects.find((o) => o.seeIndex === i)?.key ?? null), [objects]);
  const specs = useMemo<RopeSpec[]>(() => {
    const out: RopeSpec[] = [];
    // silk: each object to its guide note (Claude's explanation)
    (s.guide?.notes ?? []).forEach((n, i) => {
      const o = objects.find((x) => x.seeIndex === n.element);
      if (o) out.push({ id: `silk:${n.element}`, from: `obj:${o.key}`, to: `guide:${n.element}`, kind: "silk", color: "var(--paper)", at: (s.at.guide ?? 0) + i * 200 });
    });
    // ink: the photo, through the source's year, to its evidence card
    if (mainObj && s.at.threads !== undefined)
      cards
        .filter((c) => c.state)
        .forEach((c, i) =>
          out.push({
            id: `ink:${c.sourceId}`,
            from: `obj:${mainObj.key}`,
            to: `card:${c.sourceId}`,
            kind: "ink",
            color: LAYER_COLOR[c.layer ?? "koto"],
            year: c.year,
            cut: c.state === "absent",
            dashed: c.state === "pending",
            at: s.at.threads! + i * 140,
          }),
        );
    return out;
  }, [s.guide, s.at.guide, s.at.threads, objects, mainObj, cards]);
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
              <LiveChips
                s={s}
                finished={finished}
                replay={replay}
                note={
                  replay ? (
                    <span className="text-caption text-muted" data-testid="replay-banner">
                      {source.recordedAt.slice(5, 16).replace("-", "/").replace("T", " ")} に実行した探索の録画
                    </span>
                  ) : null
                }
              />
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
                  <TextColumn
                    s={s}
                    cards={cards}
                    elapsed={elapsed}
                    reduced={reduced}
                    hot={hot}
                    setHot={setHot}
                    actions={actions}
                    guide={<GuideCards s={s} register={register} selectedSee={selectedSee} onSelectSee={onSelectSee} />}
                    guideFocus={selectedSee !== null ? <GuideCards s={s} register={register} selectedSee={selectedSee} onSelectSee={onSelectSee} only={selectedSee} /> : null}
                  />
                </div>
                <div className="order-1 flex h-[45vh] min-h-0 justify-center lg:order-none lg:h-full">
                  <PhotoStage
                    s={s}
                    photo={photoUrl}
                    elapsed={elapsed}
                    scene={scene}
                    overlayOn={overlayOn || (ys?.state === "present" && scrub !== null && scrub < 1866)}
                    onAspect={setAspect}
                    aspect={aspect}
                    absent={absentNow}
                    absentLine={absentNow ? (ys?.label[lang] ?? null) : null}
                    dim={Boolean(scene) && s.at.space !== undefined && elapsed - s.at.space > 1200}
                    objects={
                      <ObjectsLayer
                        objects={objects}
                        sceneId={s.space?.ok ? (s.space.scene_id ?? null) : null}
                        lifted={Boolean(scene) && s.at.space !== undefined && elapsed - s.at.space > 1200}
                        faded={absentNow}
                        selected={selectedObj}
                        register={register}
                        onTouch={onTouch}
                        onSelect={(k) => setSelectedObj((v) => (v === k ? null : k))}
                      />
                    }
                  />
                </div>
                <div className="hidden min-h-0 lg:block">
                  <YearAxis s={s} cards={cards} axisRef={axisRef} scrub={scrub} onScrub={finished && s.timeline ? onScrub : undefined} scrubLabel={ys?.label[lang]} />
                </div>
                <div className="order-3 min-h-0 lg:order-none">
                  <EvidenceColumn s={s} cards={cards} register={registerCard} hot={hot} setHot={setHot} />
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
                <RopeLayer stageRef={stageRef} anchors={anchors} axisRef={axisRef} specs={specs} since={elapsed} hot={hot} reduced={reduced} pluckRef={pluckRef} />
              </div>
            )}

            <footer className="flex flex-wrap items-end justify-between gap-4 border-t border-rule pt-4">
              <ResultStrip s={s} elapsed={elapsed} />
              <LoomLegend />
            </footer>
          </main>
        </LayoutGroup>
      </MotionConfig>
    </LazyMotion>
  );
}
