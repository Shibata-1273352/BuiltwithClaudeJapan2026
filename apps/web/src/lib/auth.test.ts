import { describe, expect, it } from "vitest";
import { decideAccess, safeEqual } from "./auth";

const TOKEN = "s3cret-token-0123456789";
const base = (over: Partial<Parameters<typeof decideAccess>[0]> = {}) =>
  decideAccess({
    method: "GET",
    url: new URL("https://tsumugi.example/api/health"),
    cookieToken: undefined,
    originHeader: null,
    expectedToken: TOKEN,
    ...over,
  });

describe("decideAccess (FR-05, SEC-06)", () => {
  it("denies without a token", () => {
    expect(base()).toMatchObject({ kind: "deny", status: 401 });
  });

  it("denies a wrong cookie", () => {
    expect(base({ cookieToken: "nope" })).toMatchObject({ kind: "deny", status: 401 });
  });

  it("allows a valid cookie", () => {
    expect(base({ cookieToken: TOKEN })).toEqual({ kind: "allow" });
  });

  it("turns a valid ?token= into a cookie and strips it from the URL", () => {
    const d = base({ url: new URL(`https://tsumugi.example/?token=${TOKEN}&lang=en`) });
    expect(d.kind).toBe("set-cookie-and-redirect");
    if (d.kind === "set-cookie-and-redirect") {
      expect(d.location).toBe("https://tsumugi.example/?lang=en");
      expect(d.token).toBe(TOKEN);
    }
  });

  it("rejects a wrong ?token=", () => {
    expect(base({ url: new URL("https://tsumugi.example/?token=bad") })).toMatchObject({ kind: "deny", status: 401 });
  });

  it("rejects cross-origin state-changing requests", () => {
    expect(base({ method: "POST", cookieToken: TOKEN, originHeader: "https://evil.example" })).toMatchObject({
      kind: "deny",
      status: 403,
    });
    expect(base({ method: "POST", cookieToken: TOKEN, originHeader: null })).toMatchObject({ status: 403 });
  });

  it("allows same-origin POST", () => {
    expect(base({ method: "POST", cookieToken: TOKEN, originHeader: "https://tsumugi.example" })).toEqual({
      kind: "allow",
    });
  });

  it("fails closed when ACCESS_TOKEN is missing or short", () => {
    expect(base({ expectedToken: undefined, cookieToken: "x" })).toMatchObject({ status: 503 });
    expect(base({ expectedToken: "short", cookieToken: "short" })).toMatchObject({ status: 503 });
  });
});

describe("safeEqual", () => {
  it("compares exactly", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "")).toBe(true);
  });
});
