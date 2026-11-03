import { describe, expect, it } from "vitest";
import { plainLabel } from "./text-column";

describe("broken-thread label: the basis is not repeated, the gloss said once", () => {
  it("English: drops the trailing basis and the repeated gloss", () => {
    const en =
      "When Unbeaten Tracks in Japan was written (1878), the permanent Kaminarimon (Thunder Gate) had not yet been rebuilt after the fire (from the chronology of Kaminarimon (Thunder Gate); the writer observed Sensō-ji, not Kaminarimon (Thunder Gate))";
    expect(plainLabel(en, "en", "Kaminarimon (Thunder Gate)")).toBe("When Unbeaten Tracks in Japan was written (1878), the permanent Kaminarimon had not yet been rebuilt after the fire");
  });
  it("Japanese: drops the trailing （…） basis", () => {
    expect(plainLabel("1878年：恒久的な雷門は焼失後まだ再建されていなかった（年表（雷門）による）", "ja")).toBe("1878年：恒久的な雷門は焼失後まだ再建されていなかった");
  });
});
