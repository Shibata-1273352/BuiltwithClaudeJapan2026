import { describe, expect, it } from "vitest";
import { hedged } from "./claude";

const after = (ms: number, v: string, signal?: AbortSignal) =>
  new Promise<string>((res, rej) => {
    const t = setTimeout(() => res(v), ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      rej(new Error("aborted"));
    });
  });

describe("hedged requests (tail latency)", () => {
  it("a fast first request wins and no second one is sent", async () => {
    let calls = 0;
    const r = await hedged((s) => (calls++, after(10, "a", s)), 100);
    expect(r).toEqual({ value: "a", hedged: false });
    expect(calls).toBe(1);
  });
  it("a slow first request is overtaken by the second, which aborts the first", async () => {
    let n = 0;
    const aborted: boolean[] = [];
    const r = await hedged((s) => {
      const i = n++;
      s.addEventListener("abort", () => (aborted[i] = true));
      return after(i === 0 ? 500 : 10, i === 0 ? "slow" : "fast", s);
    }, 20);
    expect(r).toEqual({ value: "fast", hedged: true });
    expect(aborted[0]).toBe(true);
  });
  it("rejects only when every request sent failed", async () => {
    await expect(hedged(() => Promise.reject(new Error("x")), 1000)).rejects.toThrow("x");
    let n = 0;
    const r = await hedged(() => (n++ === 0 ? after(30, "").then(() => Promise.reject(new Error("first"))) : after(5, "second")), 10);
    expect(r.value).toBe("second");
  });
});
