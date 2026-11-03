import { describe, expect, it } from "vitest";
import { validateGuide, type GuideOutput } from "./guide";

const bi = (ja: string, en: string) => ({ ja, en });
const note = (over: Partial<GuideOutput["notes"][number]> = {}): GuideOutput["notes"][number] => ({
  element: 0,
  name: bi("大提灯", "Great lantern"),
  what: bi("高さ約3.9m、重さ約700kgの大提灯", "A 3.9 m paper lantern weighing about 700 kg"),
  why: bi("門の名を掲げる顔", "It carries the gate's name like a signboard"),
  try: bi("下から見上げると底に龍の彫刻", "Look up: a dragon is carved on its base"),
  kanji: [{ char: "雷", meaning: bi("かみなり", "thunder"), parts: [{ part: "雨", meaning: bi("あめ", "rain") }, { part: "田", meaning: bi("た", "field") }] }],
  questions: [bi("なぜ赤い？", "Why is it red?"), bi("誰が奉納？", "Who donated it?"), bi("いつ作られた？", "When was it made?")],
  ...over,
});
const els = [{ text_original: "風雷神門" }, { text_original: null }];

describe("guide notes (Claude's explanations, checked by code)", () => {
  it("keeps a good note", () => {
    const r = validateGuide({ notes: [note()] }, els);
    expect(r.notes).toHaveLength(1);
    expect(r.notes[0].kanji[0].char).toBe("雷");
  });
  it("drops a kanji that is not in the photo's text, and bad parts", () => {
    const r = validateGuide(
      { notes: [note({ kanji: [{ char: "龍", meaning: bi("", "dragon"), parts: [{ part: "立", meaning: bi("", "") }] }, { char: "門", meaning: bi("", "gate"), parts: [{ part: "door", meaning: bi("", "") }] }] })] },
      els,
    );
    expect(r.notes[0].kanji).toEqual([]);
  });
  it("drops notes for missing elements, duplicates and overlong fields", () => {
    const r = validateGuide({ notes: [note({ element: 5 }), note(), note(), note({ element: 1, why: bi("あ".repeat(91), "x") })] }, els);
    expect(r.notes).toHaveLength(1);
    expect(r.dropped.map((d) => d.reason).sort()).toEqual(["duplicate", "no_such_element", "too_long_or_empty"]);
  });
  it("keeps at most 3 questions", () => {
    const r = validateGuide({ notes: [note({ questions: [bi("a", "a"), bi("b", "b"), bi("c", "c"), bi("d", "d")] })] }, els);
    expect(r.notes[0].questions).toHaveLength(3);
  });
});
