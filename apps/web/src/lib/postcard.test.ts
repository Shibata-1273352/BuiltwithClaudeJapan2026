import { describe, expect, it } from "vitest";
import { postcardData, sealOf } from "./postcard";

const events = [
  { type: "place", data: { chosen: { path: [{ name: { ja: "雷門", en: "Kaminarimon" } }, { name: { ja: "浅草", en: "Asakusa" } }] } } },
  { type: "see", data: { elements: [{ text_original: null }, { text_original: "松下幸之助", box: { w: 0.1, h: 0.05 } }, { text_original: "風雷神門", box: { w: 0.5, h: 0.5 } }] } },
  { type: "guide", data: { notes: [{ element: 1 }, { element: 2 }] } },
  { type: "space", data: { ok: true, scene_id: "cap_x" } },
  { type: "candidates", data: { candidates: [{ sourceId: "bird" }, { sourceId: "kafu" }, { sourceId: "bird" }] } },
  { type: "claims", data: { claims: [{ id: "c1", source_id: "bird", status: "accepted" }, { id: "c2", source_id: "kafu", status: "rejected" }] } },
  { type: "threads", data: [{ claimId: "cl:exist:bird", state: "absent" }, { claimId: "c1", state: "ink" }] },
  { type: "existence", data: { rows: [{ source: "bird", time: { start: "1878-06-09" }, value: "absent" }] } },
  {
    type: "narrative",
    data: {
      sentences: [
        { text: "Perhaps it stood here.", claim_ids: ["c1"], assertion_type: "uncertain" },
        { text: "In 1878 the gate had not been rebuilt.", claim_ids: ["cl:exist:bird"], assertion_type: "fact" },
      ],
    },
  },
];
const titles = new Map([["bird", "Unbeaten Tracks in Japan"]]);

describe("postcard: what the visitor takes away", () => {
  const d = postcardData(events, "en", null, titles);
  it("the seal is the kanji of the largest guided element (the lantern, not the plate)", () => {
    expect(d.seal).toBe("風雷神門");
    expect(sealOf([null, "abc", "雷"])).toBeNull();
  });
  it("one checked sentence (never an uncertain one), with its source", () => {
    expect(d.sentence).toEqual({ text: "In 1878 the gate had not been rebuilt.", source: "Unbeaten Tracks in Japan" });
  });
  it("the broken thread and counted numbers", () => {
    expect(d.broken).toEqual({ year: "1878", source: "Unbeaten Tracks in Japan", interim: null });
  });
  it("says 'the permanent …' when the timeline has a temporary structure before that year", () => {
    const ev = (id: string, event: string, start: string) => ({ id, event, time: { start, end: start }, evidence: [] });
    const timeline = { type: "timeline", data: { events: [ev("a", "destroyed", "1866-01-28"), ev("b", "temporary", "1868-01-01"), ev("c", "rebuilt", "1960-05-03")] } };
    expect(postcardData([...events, timeline], "en", null, titles).broken?.interim).toBe(1868);
    expect(d.counts).toEqual({ sources: 2, threads: 2, claims: 1 });
    expect(d.place?.en).toBe("Kaminarimon");
    expect(d.area?.ja).toBe("浅草");
    expect(d.sceneId).toBe("cap_x");
  });
});
