import { afterEach, describe, expect, it, vi } from "vitest";
import { demoReplayId, isDemoReplay } from "./demo";
import { isServableSample, TRY_SAMPLES } from "./samples";

afterEach(() => vi.unstubAllEnvs());

describe("samples allowlist (例で試す)", () => {
  it("serves only names listed in corpus/samples.json", () => {
    expect(isServableSample("kaminarimon_cc0.jpg")).toBe(true);
    expect(isServableSample("../.env")).toBe(false);
    expect(isServableSample("cap_0123.jpg")).toBe(false);
    expect(isServableSample("kaminarimon_cc0.jpg/../../x.jpg")).toBe(false);
  });
  it("only the face-masked CC0 photo may start a live run", () => {
    expect([...TRY_SAMPLES]).toEqual(["kaminarimon_cc0.jpg"]);
  });
});

describe("DEMO_REPLAY_ID (the one public recording)", () => {
  it("must look like an exploration id", () => {
    vi.stubEnv("DEMO_REPLAY_ID", "exp_0123456789abcdef0123");
    expect(isDemoReplay("exp_0123456789abcdef0123")).toBe(true);
    expect(isDemoReplay("exp_ffffffffffffffffffff")).toBe(false);
    vi.stubEnv("DEMO_REPLAY_ID", "../../x");
    expect(demoReplayId()).toBeNull();
    vi.stubEnv("DEMO_REPLAY_ID", "");
    expect(isDemoReplay("exp_0123456789abcdef0123")).toBe(false);
  });
});
