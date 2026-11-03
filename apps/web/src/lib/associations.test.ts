import { describe, expect, it } from "vitest";
import { EDGE_WEIGHT, passageOfEvidence, rankAssociations, type GraphNode } from "./associations";
import type { Edge } from "./ppr";

describe("passageOfEvidence", () => {
  it("maps sentence and passage evidence ids to passage ids", () => {
    expect(passageOfEvidence("ev:bird-unbeaten:6:8:6")).toBe("bird-unbeaten:6:8");
    expect(passageOfEvidence("ev:koun-kaiko:12:12:4+koun-kaiko:12:12:6")).toBe("koun-kaiko:12:12");
    expect(passageOfEvidence("ev:passage:gotokyo-azumabashi:0:0")).toBe("gotokyo-azumabashi:0:0");
    expect(passageOfEvidence("cl:x")).toBeNull();
  });
});

describe("rankAssociations (the graph shape around Kaminarimon)", () => {
  const N = (id: string, label: string, name?: string): [string, GraphNode] => [id, { id, label, name: label === "Entity" ? name : null, title: label === "Source" ? name : null }];
  const nodes = new Map<string, GraphNode>([
    N("ent:kaminarimon", "Entity", "雷門"),
    N("ent:sensoji", "Entity", "浅草寺"),
    N("ent:kannon", "Entity", "観音"),
    N("cl:a", "Claim"),
    N("cl:b", "Claim"),
    N("cl:c", "Claim"),
    N("ev:bird-unbeaten:6:2:0", "Evidence"),
    N("ev:bird-unbeaten:6:8:6", "Evidence"),
    N("ev:kafu-hiyorigeta:5:8:1", "Evidence"),
    N("time:y:1914", "Time"),
    N("ev:passage:met-37387:0:0", "Evidence"),
  ]);
  const e = (a: string, b: string, t: string): Edge => ({ a, b, w: EDGE_WEIGHT[t] });
  const edges = [
    e("ent:kaminarimon", "ent:sensoji", "PART_OF"),
    e("ent:sensoji", "ent:kannon", "DEDICATED_TO"),
    e("cl:a", "ent:sensoji", "ABOUT"),
    e("ev:bird-unbeaten:6:2:0", "cl:a", "SUPPORTS"),
    e("cl:b", "ent:kannon", "ABOUT"),
    e("ev:bird-unbeaten:6:8:6", "cl:b", "SUPPORTS"),
    e("cl:c", "ent:kaminarimon", "ABOUT"),
    e("ev:kafu-hiyorigeta:5:8:1", "cl:c", "SUPPORTS"),
    e("cl:c", "time:y:1914", "AT_TIME"),
    e("ev:passage:met-37387:0:0", "time:y:1914", "AT_TIME"),
  ];
  const titles: Record<string, string> = { "bird-unbeaten": "Unbeaten Tracks in Japan", "kafu-hiyorigeta": "日和下駄" };
  const retrieved = new Set(["bird-unbeaten:6:2", "kafu-hiyorigeta:5:8"]);
  const r = rankAssociations(edges, nodes, "ent:kaminarimon", retrieved, (s) => titles[s]);
  it("excludes what this run retrieved", () => {
    expect(r.map((a) => a.passage)).not.toContain("bird-unbeaten:6:2");
    expect(r.map((a) => a.passage)).not.toContain("kafu-hiyorigeta:5:8");
  });
  it("ranks the structural link (gate → temple → Kannon) above a shared year", () => {
    expect(r[0].passage).toBe("bird-unbeaten:6:8");
    expect(r[0].path.map((p) => p.text)).toEqual(["雷門", "浅草寺", "観音", "主張", "Unbeaten Tracks in Japan 6:8"]);
    expect(r.at(-1)!.passage).toBe("met-37387:0:0");
  });
});
