import { describe, expect, it } from "vitest";
import { knotOf, pickQuotes, readingsInside, type Quote } from "./timeline-quotes";

const q = (text: string, source: string, lang: "ja" | "en"): Quote => ({ text, source, title: source, lang });

describe("timeline quotes", () => {
  const rebuilt = [
    q("昭和35年（1960）5月1日 95年ぶりに再建", "sensoji-official", "ja"),
    q("現在の門は、昭和35年（1960）に松下電器産業（現パナソニック）社長・松下幸之助氏の寄進により、再建された。", "sensoji-official", "ja"),
    q("The current Kaminarimon was built in 1960 with donations from Matsushita Konosuke (1894–1989)", "jta-tagengo-kaminarimon", "en"),
  ];
  it("keeps one line per language, the one that says who and what", () => {
    const p = pickQuotes(rebuilt);
    expect(p.map((x) => x.lang)).toEqual(["ja", "en"]);
    expect(p[0].text).toContain("松下幸之助");
  });
  it("ties a knot only when two languages from two sources back the event", () => {
    expect(knotOf(rebuilt)?.en.source).toBe("jta-tagengo-kaminarimon");
    expect(knotOf(rebuilt.slice(0, 2))).toBeNull();
    expect(knotOf([q("a", "s", "ja"), q("b", "s", "en")])).toBeNull();
  });
  it("finds the photo's readings inside a cut-out", () => {
    // the stored recording: Claude's boxes and SAM 3's lantern-base bbox
    const r = [
      { box: { x: 0.11, y: 0.37, w: 0.6, h: 0.43 }, text_original: "風雷神門" },
      { box: { x: 0.3, y: 0.39, w: 0.11, h: 0.37 }, text_original: "平成二十五年十一月吉日" },
      { box: { x: 0.25, y: 0.79, w: 0.29, h: 0.1 }, text_original: "松下幸之助" },
      { box: { x: 0.26, y: 0.76, w: 0.1, h: 0.05 }, text_original: null },
    ];
    expect(readingsInside(r, [0.2556, 0.7505, 0.535, 0.8367]).map((x) => x.text_original)).toEqual(["松下幸之助"]);
  });
});
