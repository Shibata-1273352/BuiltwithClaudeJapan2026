import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));

describe("presenterTokenOk (FR-46)", () => {
  const prev = process.env.PRESENTER_TOKEN;
  afterEach(() => {
    process.env.PRESENTER_TOKEN = prev;
  });

  it("accepts only the configured token", async () => {
    const { presenterTokenOk } = await import("./presenter");
    process.env.PRESENTER_TOKEN = "presenter-token-0123456789";
    expect(presenterTokenOk("presenter-token-0123456789")).toBe(true);
    expect(presenterTokenOk("presenter-token-012345678X")).toBe(false);
    expect(presenterTokenOk(undefined)).toBe(false);
  });

  it("fails closed when the token is missing or too short", async () => {
    const { presenterTokenOk } = await import("./presenter");
    delete process.env.PRESENTER_TOKEN;
    expect(presenterTokenOk("anything")).toBe(false);
    process.env.PRESENTER_TOKEN = "short";
    expect(presenterTokenOk("short")).toBe(false);
  });
});
