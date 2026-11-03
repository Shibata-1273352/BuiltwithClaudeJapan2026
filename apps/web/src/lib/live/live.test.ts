import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { MIN_SEE_SWEEP, scheduleBeats } from "./beats";
import { etaSeconds, STEPS, stepStatus } from "./eta";
import { fold, initialState, reduce, sourceCards, stripNumbers, type LiveEvent } from "./state";

const fx = JSON.parse(readFileSync(path.join(import.meta.dirname, "../../../../../fixtures/live/kaminarimon-events.json"), "utf8")) as { events: (LiveEvent & { ts: string })[] };
const events = fx.events;

describe("live state (a real recorded exploration)", () => {
  const s = fold(events);
  it("rebuilds what the stage needs", () => {
    expect(s.place?.entity).toBe("ent:kaminarimon");
    expect(s.see?.elements.length).toBeGreaterThan(0);
    expect(s.space?.ok).toBe(true);
    expect(s.visual?.hits[0].title).toBe("Kinryūzan Temple in Asakusa");
    expect(s.threads?.some((t) => t.state === "absent")).toBe(true);
    expect(s.narrative?.sentences?.length).toBeGreaterThan(3);
    expect(s.done?.claude_calls).toBe(s.calls.length);
  });
  it("is order-independent and applies a seq once", () => {
    const shuffled = [...events].reverse();
    const a = fold(shuffled);
    expect(stripNumbers(a)).toEqual(stripNumbers(s));
    const twice = events.reduce((acc, e) => reduce(reduce(acc, e), e), initialState());
    expect(stripNumbers(twice)).toEqual(stripNumbers(s));
  });
  it("one card per source; a broken thread wins the card", () => {
    const cards = sourceCards(s);
    expect(new Set(cards.map((c) => c.sourceId)).size).toBe(cards.length);
    const bird = cards.find((c) => c.sourceId === "bird-unbeaten")!;
    expect(bird.state).toBe("absent");
    expect(bird.year).toBe(1878);
    expect(bird.existence?.value).toBe("absent");
    expect(cards.find((c) => c.sourceId === "met-56689")?.state).toBe("combined");
    expect(cards.reduce((a, c) => a + c.threads.length, 0)).toBe(s.threads!.length);
  });
  it("strip numbers add up", () => {
    const n = stripNumbers(s);
    expect(n.accepted).toBeGreaterThan(10);
    expect(n.languages).toBe(2);
    expect(n.broken).toBeGreaterThan(0);
  });
});

describe("beats (6.3 choreography)", () => {
  const t0 = Date.parse(events[0].ts);
  const arrivals = events.map((e) => ({ seq: e.seq, type: String(e.type), at: Date.parse(e.ts) - t0 }));
  const shown = scheduleBeats(arrivals);
  const at = (type: string) => Math.min(...events.filter((e) => e.type === type).map((e) => shown.get(e.seq)!));
  it("never shows an event before it arrived, and keeps seq order", () => {
    let prev = -1;
    for (const a of [...arrivals].sort((x, y) => x.seq - y.seq)) {
      expect(shown.get(a.seq)!).toBeGreaterThanOrEqual(a.at);
      expect(shown.get(a.seq)!).toBeGreaterThanOrEqual(prev);
      prev = shown.get(a.seq)!;
    }
  });
  it("staggers the burst of candidates and lets the scan sweep run", () => {
    const cands = events.filter((e) => e.type === "candidates").map((e) => shown.get(e.seq)!);
    for (let i = 1; i < cands.length; i++) expect(cands[i] - cands[i - 1]).toBeGreaterThanOrEqual(140);
    expect(at("see")).toBeGreaterThanOrEqual(MIN_SEE_SWEEP);
  });
  it("shows the broken thread only after the existence judgment", () => {
    expect(at("threads")).toBeGreaterThanOrEqual(at("existence") + 700);
  });
  it("reduced motion: no holds", () => {
    const r = scheduleBeats(arrivals, { reduced: true });
    for (const a of arrivals) expect(r.get(a.seq)).toBe(a.at);
  });
});

describe("step rail and ETA", () => {
  it("counts down as steps finish", () => {
    const none = etaSeconds({}, 0);
    const seeDone = etaSeconds({ see: { started: 0, done: 13000 }, place: { started: 13000, done: 13001 } }, 13001);
    expect(none).toBeGreaterThan(seeDone);
    expect(none).toBeLessThanOrEqual(45);
  });
  it("marks a step done when its stages are done", () => {
    const see = STEPS[0];
    expect(stepStatus(see, {})).toBe("waiting");
    expect(stepStatus(see, { see: { started: 0 } })).toBe("running");
    expect(stepStatus(see, { see: { started: 0, done: 1 }, place: { started: 1, done: 2 } })).toBe("done");
  });
});
