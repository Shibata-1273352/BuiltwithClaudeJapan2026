import { describe, expect, it } from "vitest";
import { needsFullScan, normalizeForSearch, sentenceId, splitSentencesEn, splitSentencesJa } from "./text";

describe("normalizeForSearch", () => {
  it("unifies Kwan-non spellings", () => {
    const n = ["Kwan-non", "Kwannon", "KWAN-NON", "Kwan’non"].map(normalizeForSearch);
    expect(new Set(n).size).toBe(1);
    expect(n[0]).toBe("kwannon");
  });

  it("strips diacritics and macrons", () => {
    expect(normalizeForSearch("Sensō-ji Uyéno")).toBe("sensoji uyeno");
  });

  it("maps variant kanji and full-width forms", () => {
    expect(normalizeForSearch("淺草の觀音")).toBe("浅草の観音");
    expect(normalizeForSearch("金竜山")).toBe(normalizeForSearch("金龍山"));
    expect(normalizeForSearch("ＡＢＣ１２３")).toBe("abc123");
  });
});

describe("splitSentencesEn", () => {
  it("splits on sentence ends but not on Mr. or initials", () => {
    const s = splitSentencesEn(
      'ONCE for all I will describe a Buddhist temple. Mr. Chamberlain came with me. It was "grand." Then we left!',
    );
    expect(s).toEqual([
      "ONCE for all I will describe a Buddhist temple.",
      "Mr. Chamberlain came with me.",
      'It was "grand."',
      "Then we left!",
    ]);
  });

  it("keeps the exact characters (quotable)", () => {
    const text = "A broad-paved avenue leads to the _mon_, or gate.  Under it are the _Ni-ô_.";
    for (const s of splitSentencesEn(text)) expect(text.includes(s)).toBe(true);
  });
});

describe("splitSentencesJa", () => {
  it("splits on 。 and keeps quotes together", () => {
    expect(splitSentencesJa("雷門は焼けた。「観音様へ行こう。」と言った。そうか")).toEqual([
      "雷門は焼けた。",
      "「観音様へ行こう。」と言った。",
      "そうか",
    ]);
  });
});

describe("ids and scan rule", () => {
  it("formats sentence ids", () => {
    expect(sentenceId("bird-unbeaten", 5, 3, 2)).toBe("bird-unbeaten:5:3:2");
  });
  it("routes 2-char Japanese terms to full scan", () => {
    expect(needsFullScan("観音")).toBe(true);
    expect(needsFullScan("浅草寺")).toBe(false);
    expect(needsFullScan("ab")).toBe(false);
  });
});
