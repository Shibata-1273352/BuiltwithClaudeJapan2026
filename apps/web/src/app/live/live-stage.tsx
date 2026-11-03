"use client";

/**
 * The live stage (6.2, desktop 1920×1080 first; phone stacks): text | photo | year axis | evidence,
 * threads drawn across all of them. Every SSE event visibly changes something while the AI works.
 * "リスト表示" (6.4) shows the same running exploration as the accessible list.
 */
import { hasPrintRegions, NamesLoom } from "./names-loom";
import { plainLabel } from "./text-column";
import { MuteToggle } from "./mute-toggle";
import Link from "next/link";
import { domMax, LazyMotion, LayoutGroup, MotionConfig } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sourceCards } from "@/lib/live/state";
import { ExplorationView } from "../exploration-view";
import { NamesLayer, type NamesData } from "../names-layer";
import { TimeTurn } from "./time-turn";
import { Backstage } from "./backstage";
import { StagePanel } from "./stage-panel";
import { Button, ButtonLink } from "../ui/button";
import { LoomLegend } from "../ui/legend";
import { EvidenceColumn } from "./evidence-column";
import { PhotoStage, useScene } from "./photo-stage";
import { LiveChips, ResultStrip, StepRail, Toasts } from "./stage-chrome";
import { TextColumn } from "./text-column";
import { RopeLayer, type RopeSpec } from "./rope-layer";
import { ObjectsLayer } from "./objects-layer";
import { AskPanel, type AskItem } from "./ask-panel";
import { PostcardButton } from "../postcard-button";
import { GuideCards } from "./guide-cards";
import { WorldCard } from "./world-card";
import { LAYER_COLOR } from "./labels";
import { loomObjects } from "@/lib/live/objects";
import { pluck } from "@/lib/live/feel";
import { presentPeriodAround, sourceYear, yearState, type TimelineData as RiverData } from "@/lib/time-river";
import { dict, LangToggle, useDict, useLang } from "../i18n";

const T = dict({
  ja: {
    replayFallback: "記録を再生する（録画であることを表示します）",
    home: "はじめに戻る",
    homeAria: "TSUMUGI はじめに戻る",
    similar: "提灯から提灯へ・似た図像",
    back: "写真に戻す",
    overlay: "広重の絵と重ねる",
    note: "旅ノートを開く",
    time: "時をめくる",
    names: "言の地層",
    intoPrint: "絵の中へ",
    space: "間（ま）で見る",
    intoThis: "この絵の中へ",
    backstage: "舞台裏",
    list: "リスト表示",
    stage: "舞台表示",
    recorded: (d: string) => `${d} に実行した探索の録画`,
    failed: "探索を最後まで進められませんでした：",
    replayShort: "記録を再生する（録画）",
    timeTitle: (p: string) => `時をめくる：${p}はいつ、そこにあったか`,
    namesTitle: "言の地層：資料ごとの呼び名",
  },
  en: {
    replayFallback: "Play the recording (shown as a recording)",
    home: "Back to the start",
    homeAria: "TSUMUGI, back to the start",
    similar: "Lantern to lantern · a similar picture",
    back: "Back to the photo",
    overlay: "Lay Hiroshige's print over it",
    note: "Open the travel note",
    time: "Turn the years",
    names: "Layers of names",
    intoPrint: "Into the print",
    space: "See it in layers",
    intoThis: "Into this print",
    backstage: "Backstage",
    list: "List view",
    stage: "Stage view",
    recorded: (d: string) => `Recording of an exploration run on ${d}`,
    failed: "The exploration could not finish: ",
    replayShort: "Play the recording",
    timeTitle: (p: string) => `Turn the years: when was ${p} there?`,
    namesTitle: "Layers of names: what each source called it",
  },
});
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
  const t = useDict(T);
  const lastDecade = useRef<number | null>(null);
  // pull the thread: questions and Claude's cited answers (this run's passages only)
  const [asks, setAsks] = useState<AskItem[]>([]);
  const onAsk = useCallback(
    (q: string) => {
      if (!expId) return;
      setAsks((a) => [...a, { q, status: "asking" }]);
      const done = (patch: Partial<AskItem>) => setAsks((a) => a.map((x) => (x.q === q && x.status === "asking" ? { ...x, ...patch } : x)));
      fetch(`/api/explorations/${expId}/ask`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: q, lang }) })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (!r.ok) return done({ status: "error", reason: j.error });
          done({ status: "done", ok: j.ok, reason: j.reason, segments: j.segments, costUsd: j.costUsd, elapsedMs: j.elapsedMs });
          if (j.ok) pluck(320);
        })
        .catch(() => done({ status: "error" }));
    },
    [expId, lang],
  );
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
  // the print lays over the photo while the gate it shows stood (the period of the print's own year)
  const printPeriod = useMemo(() => {
    const tl = s.timeline as RiverData | undefined;
    const art = (scene as { alignment?: { artifact?: string } } | null)?.alignment?.artifact;
    const src = art ? tl?.sources.find((x) => x.source === art) : undefined;
    const y = src ? sourceYear(src.time) : null;
    return tl && y ? presentPeriodAround(tl, y) : null;
  }, [s.timeline, scene]);
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
    // ink: an answer to each source it cites (checked by code), through the source's year
    asks.forEach((a, i) => {
      const ids = [...new Set((a.segments ?? []).flatMap((sg) => sg.cites.map((c) => c.sourceId)))];
      ids.forEach((sid) => {
        const c = cards.find((x) => x.sourceId === sid);
        if (c) out.push({ id: `ask:${i}:${sid}`, from: `ask:${i}`, to: `card:${sid}`, kind: "ink", color: "var(--paper)", year: c.year, at: 0 });
      });
    });
    return out;
  }, [s.guide, s.at.guide, s.at.threads, objects, mainObj, cards, asks]);
  const finished = phase === "done";
  const runLang = s.narrative?.lang;
  const [story, setStory] = useState<{ lang: "ja" | "en"; sentences: { text: string; claim_ids: string[]; assertion_type: string }[] } | null>(null);
  useEffect(() => {
    if (!finished || !expId || !runLang || runLang === lang) return;
    let off = false;
    fetch(`/api/explorations/${expId}/narrative?lang=${lang}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!off && Array.isArray(j?.sentences)) setStory({ lang, sentences: j.sentences });
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [finished, expId, runLang, lang]);
  const sourceIds = useMemo(() => cards.map((c) => c.sourceId), [cards]);
  const titles = useMemo(() => new Map(cards.map((c) => [c.sourceId, c.title])), [cards]);
  const storyShown = story && story.lang === lang && lang !== runLang ? story : null;
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
            {t.replayFallback}
          </ButtonLink>
        )}
        <Link href="/" className="text-small text-muted underline">
          {t.home}
        </Link>
      </main>
    );
  }

  // one primary (the note), one secondary (the postcard), the rest as one quiet row — a flow, not a menu
  const quiet = [
    s.space?.aligned && s.at.visual !== undefined ? (
      <Button key="overlay" variant="quiet" onClick={() => setOverlayOn((v) => !v)} aria-pressed={overlayOn} data-testid="overlay-toggle">
        {overlayOn ? t.back : t.overlay}
      </Button>
    ) : null,
    finished && s.timeline != null ? (
      <Button key="time" variant="quiet" onClick={() => toggle("time")} aria-expanded={panel === "time"} data-testid="time-toggle">
        {t.time}
      </Button>
    ) : null,
    finished && s.names != null ? (
      <Button key="names" variant="quiet" onClick={() => toggle("names")} aria-expanded={panel === "names"} data-testid="names-toggle">
        {t.names}
      </Button>
    ) : null,
    finished && s.space?.ok && s.space.url && (s.space.elements?.length ?? 0) > 0 ? (
      <ButtonLink key="space" variant="quiet" href={`${s.space.url}${s.space.aligned ? "?enter=1" : ""}`} data-testid="space-link">
        {s.space.aligned ? t.intoPrint : t.space}
      </ButtonLink>
    ) : null,
    into && !s.space?.aligned && finished ? (
      <ButtonLink key="into" variant="quiet" href={into}>
        {t.intoThis}
      </ButtonLink>
    ) : null,
  ].filter(Boolean);
  const actions = (
    <>
      {finished && expId && s.place && (
        <ButtonLink href={`/note/${expId}`} variant="primary" data-testid="note-link">
          {t.note}
        </ButtonLink>
      )}
      {finished && expId && s.place && <PostcardButton expId={expId} />}
      {quiet.length > 0 && <div className="quiet-row col-span-2 flex flex-wrap items-center gap-x-1 lg:col-auto [&>*]:px-2">{quiet}</div>}
    </>
  );

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <LayoutGroup>
          <main className="flex min-h-dvh w-full max-w-full flex-col gap-4 overflow-x-clip px-4 py-4 lg:h-dvh lg:px-10 lg:py-5">
            <header className="flex flex-wrap items-baseline justify-between gap-x-10 gap-y-3 border-b border-rule pb-3">
              <div className="flex w-full min-w-0 flex-wrap items-baseline gap-x-10 gap-y-2 lg:w-auto">
                <Link href="/" onClick={onExit} className="font-serif text-lead tracking-[0.3em]" aria-label={t.homeAria}>
                  TSUMUGI
                </Link>
                <StepRail s={s} elapsed={elapsed} finished={finished} />
              </div>
              <div className="flex items-baseline gap-1">
                <Button variant="quiet" onClick={() => toggle("backstage")} aria-expanded={panel === "backstage"} data-testid="backstage-toggle" disabled={s.calls.length === 0}>
                  {t.backstage}
                </Button>
                <Button variant="quiet" onClick={() => setView((v) => (v === "stage" ? "list" : "stage"))} className="present-hide" data-testid="view-toggle" disabled={!expId}>
                  {view === "stage" ? t.list : t.stage}
                </Button>
                <MuteToggle />
                <LangToggle />
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
                      {t.recorded(source.recordedAt.slice(5, 16).replace("-", "/").replace("T", " "))}
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
                {t.failed}
                {s.failed.message}
                {demoReplay && (
                  <a href={`/replay/${demoReplay}`} className="ml-3 underline" data-testid="fallback-replay">
                    {t.replayShort}
                  </a>
                )}
              </p>
            )}

            {view === "list" && expId ? (
              <div className="mx-auto w-full max-w-3xl flex-1 overflow-y-auto">
                <ExplorationView attach={replay ? undefined : expId} replay={replay ? { explorationId: expId, recordedAt: source.recordedAt } : undefined} />
              </div>
            ) : (
              <div ref={stageRef} className={`relative flex min-h-0 flex-1 flex-col gap-4 lg:grid lg:gap-8 ${s.place === null ? "lg:grid-cols-[minmax(26rem,1.1fr)_auto]" : "lg:grid-cols-[minmax(20rem,1fr)_auto_6rem_minmax(22.5rem,30rem)]"}`}>
                <div className="order-2 min-h-0 lg:order-none">
                  <TextColumn
                    s={s}
                    cards={cards}
                    elapsed={elapsed}
                    reduced={reduced}
                    hot={hot}
                    setHot={setHot}
                    actions={actions}
                    guide={<GuideCards s={s} register={register} selectedSee={selectedSee} onSelectSee={onSelectSee} onAsk={finished && expId && s.place ? onAsk : undefined} />}
                    story={storyShown}
                    world={finished && s.place?.entity ? <WorldCard entity={s.place.entity} sourceIds={sourceIds} titles={titles} /> : null}
                    guideFocus={
                      <>
                        {selectedSee !== null && <GuideCards s={s} register={register} selectedSee={selectedSee} onSelectSee={onSelectSee} only={selectedSee} onAsk={expId ? onAsk : undefined} />}
                        {finished && expId && s.place && <AskPanel items={asks} onAsk={onAsk} register={register} />}
                      </>
                    }
                  />
                </div>
                <div className="order-1 flex h-[45vh] min-h-0 justify-center lg:order-none lg:h-full">
                  <PhotoStage
                    s={s}
                    photo={photoUrl}
                    elapsed={elapsed}
                    scene={scene}
                    overlayOn={overlayOn || (ys?.state === "present" && scrub !== null && printPeriod !== null && scrub >= printPeriod.from && scrub <= printPeriod.to)}
                    onAspect={setAspect}
                    aspect={aspect}
                    absent={absentNow}
                    absentLine={absentNow && ys ? plainLabel(ys.label[lang], lang, s.place?.path[0]?.name.en) : null}
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
                <div className={`hidden min-h-0 ${s.place === null ? "" : "lg:block"}`}>
                  <YearAxis s={s} cards={cards} axisRef={axisRef} scrub={scrub} onScrub={finished && s.timeline ? onScrub : undefined} scrubLabel={ys?.label[lang]} />
                </div>
                <div className={`order-3 min-h-0 lg:order-none ${s.place === null ? "hidden" : ""}`}>
                  <EvidenceColumn s={s} cards={cards} register={registerCard} hot={hot} setHot={setHot} />
                </div>
                {panel === "backstage" && <Backstage s={s} onClose={() => setPanel(null)} />}
                {panel === "time" && s.timeline != null && (
                  <StagePanel title={t.timeTitle(s.place?.path[0]?.name[lang] ?? "")} onClose={() => setPanel(null)} testid="time-panel" wide>
                    <TimeTurn data={s.timeline as RiverData} sceneId={s.space?.scene_id ?? null} scene={scene as never} photo={photoUrl} cards={cards} />
                  </StagePanel>
                )}
                {panel === "names" && s.names != null && (
                  <StagePanel title={t.namesTitle} onClose={() => setPanel(null)} testid="names-panel" wide>
                    {hasPrintRegions((scene as { alignment?: { artifact?: string } } | null)?.alignment?.artifact) ? (
                      <NamesLoom names={s.names as NamesData} artifact={(scene as { alignment: { artifact: string } }).alignment.artifact} />
                    ) : (
                      <NamesLayer names={s.names as NamesData} lang={lang} />
                    )}
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
