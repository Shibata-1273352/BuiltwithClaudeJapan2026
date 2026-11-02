import { describe, expect, it } from "vitest";
import { cleanLine, parseAozora } from "./parse-aozora";
import { parseGutenberg } from "./parse-gutenberg";

const GUT = `The Project Gutenberg eBook of Test
license text here

*** START OF THE PROJECT GUTENBERG EBOOK TEST ***

PREFACE

Some preface text.

LETTER V.

Kwan-non Temple—A Perpetual Festival.

ONCE for all I will describe a
Buddhist temple, the _popular_ temple of Asakusa.

INDEX.

Asakusa, 33

*** END OF THE PROJECT GUTENBERG EBOOK TEST ***
more license`;

describe("parseGutenberg", () => {
  const b = parseGutenberg(GUT, /^LETTER [IVXLC]+\..*$/);
  it("separates the license", () => {
    expect(b.license).toContain("license text here");
    expect(b.license).toContain("more license");
    expect(JSON.stringify(b.chapters)).not.toContain("license text");
  });
  it("splits chapters and joins wrapped lines, removing italics markers", () => {
    expect(b.chapters.map((c) => [c.label, c.kind])).toEqual([
      ["front matter", "front"],
      ["LETTER V.", "body"],
      ["INDEX", "index"],
    ]);
    expect(b.chapters[1].paragraphs[1].text).toBe("ONCE for all I will describe a Buddhist temple, the popular temple of Asakusa.");
  });
});

const AOZ = `日和下駄
一名　東京散策記
永井荷風

-------------------------------------------------------
【テキスト中に現れる記号について】
《》：ルビ
-------------------------------------------------------

［＃５字下げ］序［＃「序」は中見出し］

この度｜米刃堂《へいじんどう》主人のもとめにより改竄《かいざん》して一巻とはなせしなり。
［＃改丁］
［＃５字下げ］第一　日和下駄［＃「第一　日和下駄」は中見出し］

　浅草の観音堂※［＃「米＋參」、第3水準1-89-88］について論ずれば雷門は既に焼失せてしまった。

底本：「荷風随筆集(上)」岩波文庫
入力：xxx
`;

describe("parseAozora", () => {
  const a = parseAozora(AOZ);
  it("drops header/footer and splits sections by 見出し", () => {
    expect(a.title).toBe("日和下駄");
    expect(a.sections.map((s) => s.label)).toEqual(["序", "第一　日和下駄"]);
    expect(a.colophon).toMatch(/^底本：/);
  });
  it("extracts ruby with offsets and keeps base text only", () => {
    const p = a.sections[0].paragraphs[0];
    expect(p.text).toBe("この度米刃堂主人のもとめにより改竄して一巻とはなせしなり。");
    expect(p.ruby).toEqual([
      { base: "米刃堂", reading: "へいじんどう", offset: 3 },
      { base: "改竄", reading: "かいざん", offset: 15 },
    ]);
  });
  it("replaces gaiji with ※ and keeps the note", () => {
    const p = a.sections[1].paragraphs[0];
    expect(p.text).toBe("浅草の観音堂※について論ずれば雷門は既に焼失せてしまった。");
    expect(p.notes?.[0]).toContain("米＋參");
  });
  it("returns null for annotation-only lines", () => {
    expect(cleanLine("［＃改丁］")).toBeNull();
  });
});
