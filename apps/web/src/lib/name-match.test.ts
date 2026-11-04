import { describe, expect, it } from "vitest";
import { sharedEn, sharedJa, splitAt } from "./name-match";

const ja = "現在の門は、昭和35年（1960）に松下電器産業（現パナソニック）社長・松下幸之助氏の寄進により、再建された。";
const en = "The current Kaminarimon was built in 1960 with donations from Matsushita Konosuke (1894–1989)";

describe("the name in the photo, in the record", () => {
  it("finds each line of the plate in the Japanese record", () => {
    expect(sharedJa(["松下電器産業株式会社 松下幸之助"], ja)).toEqual(["松下電器産業", "松下幸之助"]);
    expect(sharedJa(["松下幸之助"], ja)).toEqual(["松下幸之助"]);
  });
  it("does not call a short common run a name", () => {
    expect(sharedJa(["現在の"], ja)).toEqual([]);
    expect(sharedJa(["風雷神門"], ja)).toEqual([]);
  });
  it("finds the romanised reading in the English record, macrons ignored", () => {
    expect(sharedEn(["Matsushita Kōnosuke"], en)).toEqual(["Matsushita Konosuke"]);
  });
  it("needs two words in English", () => {
    expect(sharedEn(["Kaminarimon"], en)).toEqual([]);
    expect(sharedEn(["Matsushita Denki"], en)).toEqual([]);
  });
  it("cuts a line at the names", () => {
    expect(splitAt("aXb", ["X"])).toEqual([{ text: "a", hit: false }, { text: "X", hit: true }, { text: "b", hit: false }]);
    expect(splitAt("ab", [])).toEqual([{ text: "ab", hit: false }]);
  });
});
