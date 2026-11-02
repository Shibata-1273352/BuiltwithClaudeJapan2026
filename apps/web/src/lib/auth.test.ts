import { describe, expect, it } from "vitest";
import { decideAccess, requestHosts, safeEqual } from "./auth";

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
      expect(d.location).toBe("/?lang=en"); // relative: works behind a tunnel
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

  it("allows same-origin POST by Host match", () => {
    expect(
      base({ method: "POST", cookieToken: TOKEN, originHeader: "https://tsumugi.example", allowedHosts: ["tsumugi.example"] }),
    ).toEqual({ kind: "allow" });
  });

  it("works behind an HTTPS tunnel (server URL is localhost, browser Origin is the public host)", () => {
    const tunnel = {
      method: "POST",
      url: new URL("http://localhost:3000/api/captures"),
      cookieToken: TOKEN,
      originHeader: "https://abc-def.trycloudflare.com",
    };
    expect(base({ ...tunnel, allowedHosts: ["abc-def.trycloudflare.com"] })).toEqual({ kind: "allow" });
    expect(base({ ...tunnel, secFetchSite: "same-origin", allowedHosts: [] })).toEqual({ kind: "allow" });
    expect(base({ ...tunnel, allowedHosts: ["localhost:3000"] })).toMatchObject({ status: 403 });
  });

  it("Fetch Metadata wins: a cross-site request is rejected even with a matching Origin", () => {
    expect(
      base({
        method: "POST",
        cookieToken: TOKEN,
        originHeader: "https://tsumugi.example",
        allowedHosts: ["tsumugi.example"],
        secFetchSite: "cross-site",
      }),
    ).toMatchObject({ status: 403 });
  });

  it("fails closed when ACCESS_TOKEN is missing or short", () => {
    expect(base({ expectedToken: undefined, cookieToken: "x" })).toMatchObject({ status: 503 });
    expect(base({ expectedToken: "short", cookieToken: "short" })).toMatchObject({ status: 503 });
  });
});

describe("requestHosts", () => {
  it("collects Host, X-Forwarded-Host and PUBLIC_ORIGINS", () => {
    const h = new Headers({ host: "localhost:3000", "x-forwarded-host": "abc.trycloudflare.com" });
    expect(requestHosts(h, "https://tsumugi.example, not a url")).toEqual(["localhost:3000", "abc.trycloudflare.com", "tsumugi.example"]);
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
