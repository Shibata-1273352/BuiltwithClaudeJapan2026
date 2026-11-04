"use client";

/**
 * One hook for the live stage, the replay and the presenter: start (upload / CC0 sample) or attach
 * (replay), listen to every event type, schedule beats (6.3) and fold the events that are due.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { EVENT_TYPES } from "@/lib/dag/event-types";
import { scheduleBeats, type Arrival } from "@/lib/live/beats";
import { fold, type LiveEvent, type LiveState } from "@/lib/live/state";

export type Source =
  | { kind: "upload"; jpeg: Blob; useLocation: boolean }
  | { kind: "sample"; name?: string }
  | { kind: "replay"; explorationId: string; photo: string; recordedAt: string; instant?: boolean }
  /** back to a run of this session (the visitor went to the note or the print and came back): no new run */
  | { kind: "attach"; explorationId: string; photo: string };

export type Phase = "starting" | "running" | "done" | "failed" | "refused";

// user-facing errors in the page language (FR-40; the hook reads <html lang>, set by LangProvider)
const ERR = {
  ja: {
    refusal: {
      killed: "現在、新しい探索を停止しています（管理者の操作）",
      hourly_limit: "1時間あたりの探索の上限に達しました。しばらくしてからお試しください",
      daily_cost: "本日の利用上限に達しました",
    } as Record<string, string>,
    upload: (why: string) => `送信できませんでした（${why}）`,
    start: (why: string) => `探索を始められませんでした：${why}`,
    network: "通信に失敗しました",
  },
  en: {
    refusal: {
      killed: "New explorations are paused right now (by the operator)",
      hourly_limit: "The hourly limit of explorations has been reached. Please try again a little later",
      daily_cost: "Today's usage limit has been reached",
    } as Record<string, string>,
    upload: (why: string) => `Could not send the photo (${why})`,
    start: (why: string) => `Could not start the exploration: ${why}`,
    network: "Network error",
  },
};
const pageLang = (): "ja" | "en" => (/(?:^|; )tsumugi_lang=en(?:;|$)/.test(document.cookie) || document.documentElement.lang === "en" ? "en" : "ja");
/** no event for this long while running: the server is gone; say so and offer the recording */
const STALL_MS = 30_000;

function getPosition(): Promise<{ lat: number; lon: number } | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    ),
  );
}

function usePrefersReducedMotion(): boolean {
  const [r, setR] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setR(m.matches || new URLSearchParams(location.search).get("motion") === "0");
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  return r;
}

export function useExploration(source: Source) {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [arrivals, setArrivals] = useState<Arrival[]>([]);
  const [expId, setExpId] = useState<string | null>(source.kind === "replay" || source.kind === "attach" ? source.explorationId : null);
  const [photo, setPhoto] = useState<string | null>(source.kind === "replay" || source.kind === "attach" ? source.photo : null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const [t0State, setT0State] = useState(0); // for render
  const t0 = useRef(0); // for event handlers
  const started = useRef(false);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let es: EventSource | null = null;
    const L = ERR[pageLang()];
    const mark = () => {
      t0.current = performance.now();
      setT0State(t0.current);
      setNow(t0.current);
    };
    let lastAt = performance.now();
    let watchdog: ReturnType<typeof setInterval> | null = null;
    const stalled = () => {
      if (watchdog) clearInterval(watchdog);
      es?.close();
      setEvents((p) => (p.some((x) => x.type === "done" || x.type === "failed") ? p : [...p, { seq: Number.MAX_SAFE_INTEGER, type: "failed", data: { reason: "stalled" } }]));
      setPhase("failed");
    };
    const listen = (url: string) => {
      es = new EventSource(url);
      lastAt = performance.now();
      watchdog = setInterval(() => {
        if (performance.now() - lastAt > STALL_MS) stalled();
      }, 2000);
      // a closed stream (the server went away and the browser gave up reconnecting)
      es.onerror = () => {
        if (es?.readyState === EventSource.CLOSED) stalled();
      };
      const on = (e: MessageEvent) => {
        lastAt = performance.now();
        const ev: LiveEvent = { seq: Number(e.lastEventId), type: e.type, data: JSON.parse(e.data) };
        const at = performance.now() - t0.current;
        setEvents((p) => (p.some((x) => x.seq === ev.seq) ? p : [...p, ev]));
        setArrivals((p) => (p.some((x) => x.seq === ev.seq) ? p : [...p, { seq: ev.seq, type: ev.type, at }]));
        if (e.type === "done") {
          setPhase("done");
          if (source.kind === "replay" && !source.instant) {
            try {
              const u = new URL(location.href);
              u.searchParams.set("at", "end");
              history.replaceState(history.state, "", u);
            } catch {}
          }
          es?.close();
          if (watchdog) clearInterval(watchdog);
        }
        if (e.type === "failed") {
          setPhase("failed");
          es?.close();
          if (watchdog) clearInterval(watchdog);
        }
      };
      for (const t of EVENT_TYPES) es.addEventListener(t, on);
    };
    if (source.kind === "sample" || source.kind === "upload") void fetch("/api/warm", { method: "POST" }).catch(() => {}); // models load while the photo is sent
    (async () => {
      if (source.kind === "replay") {
        mark();
        setPhase("running");
        listen(`/api/explorations/${source.explorationId}/events?pace=replay${source.instant ? "&instant=1" : ""}`);
        return;
      }
      if (source.kind === "attach") {
        mark();
        setPhase("running");
        listen(`/api/explorations/${source.explorationId}/events`);
        return;
      }
      let start: Response;
      if (source.kind === "sample") {
        start = await fetch("/api/explorations/sample", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: source.name, lang: pageLang() }) });
      } else {
        setPhoto(URL.createObjectURL(source.jpeg));
        const form = new FormData();
        form.append("image", source.jpeg, "capture.jpg");
        form.append("lang", pageLang());
        if (source.useLocation) {
          const pos = await getPosition();
          if (pos) {
            form.append("lat", String(pos.lat));
            form.append("lon", String(pos.lon));
          }
        }
        const up = await fetch("/api/captures", { method: "POST", body: form });
        if (!up.ok) {
          setPhase("refused");
          setError(L.upload(String((await up.json().catch(() => ({}))).error ?? up.status)));
          return;
        }
        const { capture_id } = await up.json();
        start = await fetch("/api/explorations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ capture_id }) });
      }
      if (!start.ok) {
        const reason = String((await start.json().catch(() => ({}))).error ?? start.status);
        setPhase("refused");
        setError(L.start(L.refusal[reason] ?? reason));
        return;
      }
      const j = (await start.json()) as { exploration_id: string; events: string; photo?: string };
      if (j.photo) setPhoto(j.photo);
      setExpId(j.exploration_id);
      // the address now names this run: Back from the note or the print returns to it, not to a new run
      try {
        history.replaceState(history.state, "", `/live?run=${j.exploration_id}`);
      } catch {}
      mark();
      setPhase("running");
      listen(j.events);
    })().catch(() => {
      setPhase("refused");
      setError(L.network);
    });
    return () => {
      es?.close();
      if (watchdog) clearInterval(watchdog);
    };
  }, [source]);

  // a clock for timers and beats (10 Hz is enough; stops when everything has been shown)
  const schedule = useMemo(() => scheduleBeats(arrivals, { reduced }), [arrivals, reduced]);
  const lastBeat = useMemo(() => Math.max(0, ...schedule.values()), [schedule]);
  const elapsed = Math.max(0, now - t0State);
  useEffect(() => {
    if ((phase === "done" || phase === "failed") && elapsed > lastBeat + 8000) return;
    const t = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(t);
  }, [phase, elapsed, lastBeat]);

  const visible = useMemo(() => events.filter((e) => (schedule.get(e.seq) ?? Infinity) <= elapsed), [events, schedule, elapsed]);
  const shownAt = (seq: number) => schedule.get(seq) ?? 0;
  const state: LiveState = useMemo(() => fold(visible, shownAt), [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const settled = (phase === "done" || phase === "failed") && visible.length === events.length;
  return { state, phase: settled ? phase : phase === "done" || phase === "failed" ? "running" : phase, error, expId, photo, elapsed, reduced, allEvents: events };
}
