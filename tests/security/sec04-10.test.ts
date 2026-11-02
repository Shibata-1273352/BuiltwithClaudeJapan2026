/**
 * SEC-04..10 (REQUIREMENTS.md 9.4.4). Deterministic; SEC-08 needs Neo4j (skipped if unreachable),
 * SEC-10 needs gitleaks (skipped if not installed). SEC-07's server side runs in pytest.
 */
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { Entities, EntityDictionary } from "@tsumugi/core";
import { afterAll, describe, expect, it, vi } from "vitest";
import { decideAccess } from "../../apps/web/src/lib/auth";
import { migrate } from "../../apps/web/src/lib/corpus/db";
import { LIMITS, searchEntities } from "../../apps/web/src/lib/corpus/search";
import { BUDGET, RunContext } from "../../apps/web/src/lib/dag/run";
import { validateGaps } from "../../apps/web/src/lib/gap";
import { checkAndStripJpeg, UploadError } from "../../apps/web/src/lib/jpeg";

const ROOT = path.join(import.meta.dirname, "..", "..");
const E = new Entities(EntityDictionary.parse(JSON.parse(readFileSync(path.join(ROOT, "corpus", "entities.json"), "utf8"))));

describe("SEC-04: tool arguments and call budgets", () => {
  const db = new Database(":memory:");
  migrate(db);
  it("rejects too many or too long search terms", () => {
    expect(() => searchEntities(db, Array(LIMITS.termsPerQuery + 1).fill("a"), "en")).toThrow();
    expect(() => searchEntities(db, ["x".repeat(LIMITS.termLength + 1)], "en")).toThrow();
  });
  it("treats query syntax as literal text (no FTS/SQL injection)", () => {
    expect(() => searchEntities(db, ['") OR 1=1 --', "NEAR(a b)", "*"], "en")).not.toThrow();
  });
  it("caps Claude calls per exploration", () => {
    const ctx = new RunContext("exp_test");
    for (let i = 0; i < BUDGET.maxClaudeCalls; i++) ctx.claude();
    expect(() => ctx.claude()).toThrow(/budget/);
  });
  it("drops gap proposals with unknown entities or query syntax", () => {
    const v = validateGaps(
      { assessment: "", enough: false, gaps: [{ facet: "naming", lang: "en", entity: "ent:sensoji", reason: "", terms: ['x" OR "y', "temple"] }, { facet: "naming", lang: "en", entity: "ent:evil", reason: "", terms: ["a"] }] },
      E,
    );
    expect(v).toHaveLength(1);
    expect(v[0].terms).toEqual(["temple"]);
  });
});

describe("SEC-05: HTML in narrative / sources is never rendered as HTML", () => {
  const files = (dir: string): string[] =>
    readdirSync(dir).flatMap((f) => {
      const p = path.join(dir, f);
      return statSync(p).isDirectory() ? files(p) : /\.(tsx?|jsx?)$/.test(f) ? [p] : [];
    });
  it("no dangerouslySetInnerHTML / innerHTML / eval in the web app", () => {
    const offenders = files(path.join(ROOT, "apps", "web", "src")).filter((f) => /dangerouslySetInnerHTML|\.innerHTML\s*=|\beval\(/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
  it("React escapes a <script> payload as text", async () => {
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { createElement } = await import("react");
    const html = renderToStaticMarkup(createElement("p", null, '<script>alert("x")</script><img src=x onerror=alert(1)>'));
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });
  it("CSP forbids inline eval in production and external connections", () => {
    const cfg = readFileSync(path.join(ROOT, "apps", "web", "next.config.ts"), "utf8");
    expect(cfg).toContain("connect-src 'self'");
    expect(cfg).toContain("frame-ancestors 'none'");
    expect(cfg).toMatch(/isDev \? " 'unsafe-eval'" : ""/);
  });
});

describe("SEC-06: no token / cross-origin", () => {
  const TOKEN = "s3cret-token-0123456789";
  const base = { url: new URL("https://h.example/api/explorations"), expectedToken: TOKEN, allowedHosts: ["h.example"] };
  it("rejects requests without a token", () => {
    expect(decideAccess({ ...base, method: "POST", cookieToken: undefined, originHeader: "https://h.example" })).toMatchObject({ status: 401 });
  });
  it("rejects cross-site state changes even with a valid cookie", () => {
    expect(decideAccess({ ...base, method: "POST", cookieToken: TOKEN, originHeader: "https://evil.example" })).toMatchObject({ status: 403 });
    expect(decideAccess({ ...base, method: "POST", cookieToken: TOKEN, originHeader: "https://h.example", secFetchSite: "cross-site" })).toMatchObject({
      status: 403,
    });
  });
});

describe("SEC-07: inference server responses are validated before use", () => {
  it("treats a malformed /health response as unavailable (falls back to simple display)", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ ok: "yes", device: { evil: true } }), { status: 200 }));
    vi.doMock("../../apps/web/src/lib/neo4j", () => ({ graphHealth: async () => ({ ok: false }) }));
    const { getHealth } = await import("../../apps/web/src/lib/health");
    const h = await getHealth();
    expect(h.inference.ok).toBe(false);
    vi.unstubAllGlobals();
    vi.doUnmock("../../apps/web/src/lib/neo4j");
    vi.resetModules();
  });
});

const neo4jUp = (() => {
  try {
    execFileSync("nc", ["-z", "127.0.0.1", "7687"], { stdio: "ignore", timeout: 2000 });
    return Boolean(process.env.NEO4J_PASSWORD);
  } catch {
    return false;
  }
})();

describe.skipIf(!neo4jUp)("SEC-08: invalidating a claim invalidates what depends on it", () => {
  const ids = { root: "test:cl:root", dep: "test:cl:dep", th: "test:th:dep", ns: "test:ns:0" };
  afterAll(async () => {
    const { withWriteTx } = await import("../../apps/web/src/lib/neo4j");
    await withWriteTx((tx) => tx.run("MATCH (n) WHERE n.id STARTS WITH 'test:' DETACH DELETE n"));
  });
  it("propagates to dependent claims, their threads and narrative sentences", async () => {
    const { withWriteTx } = await import("../../apps/web/src/lib/neo4j");
    await withWriteTx(async (tx) => {
      await tx.run(
        `MERGE (r:Claim {id: $root}) SET r.status = 'accepted'
         MERGE (d:Claim {id: $dep}) SET d.status = 'accepted'
         MERGE (d)-[:DEPENDS_ON]->(r)
         MERGE (t:Thread {id: $th}) SET t.state = 'absent' MERGE (t)-[:SHOWS]->(d)
         MERGE (s:NarrativeSentence {id: $ns}) SET s.text = 'x' MERGE (s)-[:CITES]->(d)`,
        ids,
      );
    });
    const { invalidateClaim } = await import("../../apps/web/src/lib/graph-invalidate");
    const impact = await invalidateClaim(ids.root, "SEC-08 test");
    expect(impact.claims.sort()).toEqual([ids.dep, ids.root].sort());
    expect(impact.threads).toEqual([ids.th]);
    expect(impact.sentences).toEqual([ids.ns]);
    const { withReadTx } = await import("../../apps/web/src/lib/neo4j");
    const state = await withReadTx(async (tx) => {
      const r = await tx.run("MATCH (d:Claim {id: $dep}), (t:Thread {id: $th}), (s:NarrativeSentence {id: $ns}) RETURN d.status AS d, t.state AS t, s.invalid AS s", ids);
      return r.records[0].toObject();
    });
    expect(state).toEqual({ d: "invalidated", t: "invalidated", s: true });
  });
});

describe("SEC-09: huge / pixel-bomb / disguised uploads are rejected", () => {
  const sof = (w: number, h: number) => [0xff, 0xc0, 0x00, 0x0b, 0x08, h >> 8, h & 255, w >> 8, w & 255, 0x01, 0x01, 0x11, 0x00];
  const jpeg = (w: number, h: number) => Uint8Array.from([0xff, 0xd8, ...sof(w, h), 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xff, 0xd9]);
  it("rejects >8MB, too many pixels, SVG/PNG disguised as JPEG", () => {
    const big = new Uint8Array(9 * 2 ** 20);
    big.set([0xff, 0xd8, 0xff]);
    expect(() => checkAndStripJpeg(big)).toThrow(UploadError);
    expect(() => checkAndStripJpeg(jpeg(20000, 20000))).toThrow(/dimensions/);
    expect(() => checkAndStripJpeg(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toThrow(/not a JPEG/);
    expect(() => checkAndStripJpeg(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]))).toThrow(/not a JPEG/);
  });
  it("accepts a normal JPEG", () => {
    expect(checkAndStripJpeg(jpeg(2048, 1536))).toMatchObject({ width: 2048, height: 1536 });
  });
});

const gitleaks = (() => {
  try {
    execFileSync("gitleaks", ["version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!gitleaks)("SEC-10: repository secret scan", () => {
  it("finds no secrets in git history", () => {
    // exits non-zero (and throws) if leaks are found
    const out = execFileSync("gitleaks", ["git", "--redact", "--no-banner", "--exit-code", "1", ROOT], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    expect(out).not.toMatch(/leaks found: [1-9]/);
  });
});
