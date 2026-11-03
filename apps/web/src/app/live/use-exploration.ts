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
  | { kind: "replay"; explorationId: string; photo: string; recordedAt: string };

export type Phase = "starting" | "running" | "done" | "failed" | "refused";

const REFUSAL: Record<string, string> = {
  killed: "現在、新しい探索を停止しています（管理者の操作）",
  hourly_limit: "1時間あたりの探索の上限に達しました。しばらくしてからお試しください",
  daily_cost: "本日の利用上限に達しました",
};

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
  const [expId, setExpId] = useState<string | null>(source.kind === "replay" ? source.explorationId : null);
  const [photo, setPhoto] = useState<string | null>(source.kind === "replay" ? source.photo : null);
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
    const mark = () => {
      t0.current = performance.now();
      setT0State(t0.current);
      setNow(t0.current);
    };
    const listen = (url: string) => {
      es = new EventSource(url);
      const on = (e: MessageEvent) => {
        const ev: LiveEvent = { seq: Number(e.lastEventId), type: e.type, data: JSON.parse(e.data) };
        const at = performance.now() - t0.current;
        setEvents((p) => (p.some((x) => x.seq === ev.seq) ? p : [...p, ev]));
        setArrivals((p) => (p.some((x) => x.seq === ev.seq) ? p : [...p, { seq: ev.seq, type: ev.type, at }]));
        if (e.type === "done") {
          setPhase("done");
          es?.close();
        }
        if (e.type === "failed") {
          setPhase("failed");
          es?.close();
        }
      };
      for (const t of EVENT_TYPES) es.addEventListener(t, on);
    };
    if (source.kind !== "replay") void fetch("/api/warm", { method: "POST" }).catch(() => {}); // models load while the photo is sent
    (async () => {
      if (source.kind === "replay") {
        mark();
        setPhase("running");
        listen(`/api/explorations/${source.explorationId}/events?pace=replay`);
        return;
      }
      let start: Response;
      if (source.kind === "sample") {
        start = await fetch("/api/explorations/sample", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: source.name, lang: document.documentElement.lang === "en" ? "en" : "ja" }) });
      } else {
        setPhoto(URL.createObjectURL(source.jpeg));
        const form = new FormData();
        form.append("image", source.jpeg, "capture.jpg");
        form.append("lang", document.documentElement.lang === "en" ? "en" : "ja");
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
          setError(`送信できませんでした（${(await up.json().catch(() => ({}))).error ?? up.status}）`);
          return;
        }
        const { capture_id } = await up.json();
        start = await fetch("/api/explorations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ capture_id }) });
      }
      if (!start.ok) {
        const reason = String((await start.json().catch(() => ({}))).error ?? start.status);
        setPhase("refused");
        setError(`探索を始められませんでした：${REFUSAL[reason] ?? reason}`);
        return;
      }
      const j = (await start.json()) as { exploration_id: string; events: string; photo?: string };
      if (j.photo) setPhoto(j.photo);
      setExpId(j.exploration_id);
      mark();
      setPhase("running");
      listen(j.events);
    })().catch(() => {
      setPhase("refused");
      setError("通信に失敗しました");
    });
    return () => es?.close();
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
