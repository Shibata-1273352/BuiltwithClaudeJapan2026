import { readFile } from "node:fs/promises";
import { eventQuotes } from "@/lib/timeline-quotes-server";
import { pickQuotes } from "@/lib/timeline-quotes";
import path from "node:path";
import { ImageResponse } from "next/og";
import { sourceTitles } from "@/lib/corpus/titles";
import { readCacheFile, readCacheJson } from "@/lib/data-files";
import { eventsAfter } from "@/lib/dag/events";
import { isDemoReplay } from "@/lib/demo";
import { cachedNarrative } from "@/lib/narrative-service";
import { postcardData } from "@/lib/postcard";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";

/**
 * GET ?lang=ja|en — the 9:16 postcard (1080×1920), an answer to the friend's two questions: what it
 * says (Claude's reading) and how long it has been here (code, from the timeline), with the record's
 * words about the rebuild. No Claude call.
 */
const W = 1080;
const H = 1920;
const C = { night: "#0e1426", paper: "#f3ecdf", muted: "#b8bfd3", toki: "#e2b65a", ba: "#e0603f", rule: "rgba(243,236,223,0.18)" };

async function font(file: string): Promise<ArrayBuffer | null> {
  const dir = process.env.DATA_DIR;
  if (!dir) return null;
  try {
    const b = await readFile(/* turbopackIgnore: true */ path.join(dir, "fonts", file));
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
  } catch {
    return null;
  }
}

type SceneJson = { elements?: Record<string, { bbox: [number, number, number, number]; png: string }> };

export async function GET(req: Request, ctx: RouteContext<"/api/explorations/[id]/postcard">) {
  const { id } = await ctx.params;
  if (!/^exp_[0-9a-f]{20}$/.test(id)) return new Response(null, { status: 404 });
  const sid = await sessionId();
  const row = store().prepare("SELECT session_id, status FROM explorations WHERE id = ?").get(id) as { session_id: string; status: string } | undefined;
  if (!row || (!(sid && row.session_id === sid) && !isDemoReplay(id))) return new Response(null, { status: 404 });
  if (row.status !== "done") return Response.json({ error: "not_ready" }, { status: 409 });
  const lang = new URL(req.url).searchParams.get("lang") === "en" ? "en" : "ja";

  const [regular, bold] = await Promise.all([font("ShipporiMincho-Regular.ttf"), font("ShipporiMincho-Bold.ttf")]);
  if (!regular || !bold) return Response.json({ error: "fonts_missing", hint: "put ShipporiMincho-Regular.ttf / -Bold.ttf in DATA_DIR/fonts" }, { status: 503 });

  const evs = eventsAfter(id, 0);
  const d = postcardData(evs, lang, cachedNarrative(id, lang)?.sentences ?? null, sourceTitles());
  // the last rebuild of the place, in its record's own words (the reader's language when there is one)
  const tl = evs.filter((e) => e.type === "timeline").at(-1)?.data as { entity?: string; events?: { id: string; event: string }[] } | undefined;
  const rebuild = tl?.entity ? [...(tl.events ?? [])].reverse().find((e) => e.event === "rebuilt") : undefined;
  const rq = rebuild && tl?.entity ? (eventQuotes(tl.entity)[rebuild.id] ?? []) : [];
  const gift = pickQuotes(rq).find((q) => q.lang === lang) ?? pickQuotes(rq)[0] ?? null;
  // the cut-out: the lantern if SAM 3 found it, else the largest object (people never)
  let cut: string | null = null;
  let aspect = 1;
  if (d.sceneId) {
    const scene = await readCacheJson<SceneJson>("scenes", d.sceneId, "scene.json");
    const els = Object.entries(scene?.elements ?? {}).filter(([k]) => k !== "people");
    const area = ([, e]: (typeof els)[number]) => (e.bbox[2] - e.bbox[0]) * (e.bbox[3] - e.bbox[1]);
    const pick = els.find(([k]) => k === "lantern") ?? els.sort((a, b) => area(b) - area(a))[0];
    const f = pick ? await readCacheFile("scenes", d.sceneId, pick[1].png) : null;
    if (f && pick) {
      cut = `data:${f.type};base64,${f.body.toString("base64")}`;
      const [x1, y1, x2, y2] = pick[1].bbox;
      aspect = (x2 - x1) / Math.max(0.01, y2 - y1);
    }
  }
  // English: the short name large, the gloss with the Japanese below ("Kaminarimon" / "Thunder Gate · 雷門")
  const gloss = d.place?.en.match(/\(([^)]*)\)\s*$/)?.[1] ?? null;
  const shortEn = d.place ? d.place.en.replace(/\s*\([^)]*\)\s*$/, "") : "";
  const placeMain = d.place ? (lang === "ja" ? d.place.ja : shortEn) : "TSUMUGI";
  const placeSub = d.place ? (lang === "ja" ? d.place.en : [gloss, d.place.ja].filter(Boolean).join(" · ")) : "";
  const t =
    lang === "ja"
      ? { q1: "これ、なんて書いてあるの？", q2: "いつからあるの？", since: (y: string) => `${y}年から`, byClaude: "Claude が写真から読んだ", byCode: "年表で判定（プログラム）", by: "Claude が読み、プログラムが確かめた" }
      : { q1: "What does it say?", q2: "How long has it been here?", since: (y: string) => `Since ${y}`, byClaude: "read from the photo by Claude", byCode: "decided by code, from the timeline", by: "Read by Claude, checked by code" };
  const cutH = 720;
  const cutW = Math.min(960, cutH * aspect);

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, display: "flex", flexDirection: "column", background: C.night, color: C.paper, fontFamily: "Mincho", padding: "90px 80px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 30, letterSpacing: 12, color: C.muted }}>
          <span>TSUMUGI</span>
          <span style={{ fontSize: 26, letterSpacing: 2 }}>{d.area ? d.area[lang] : ""}</span>
        </div>
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "center", position: "relative" }}>
          {cut ? (
            // eslint-disable-next-line @next/next/no-img-element -- satori renders plain img
            <img src={cut} width={cutW} height={cutH * Math.min(1, 960 / (cutH * aspect))} alt="" style={{ objectFit: "contain" }} />
          ) : (
            <div style={{ display: "flex", fontSize: 220, fontWeight: 700 }}>{placeMain}</div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", borderTop: `2px solid ${C.rule}`, paddingTop: 44 }}>
          <span style={{ fontSize: 44, fontWeight: 700, lineHeight: 1.1 }}>{placeMain}</span>
          {placeSub && <span style={{ fontSize: 28, color: C.muted, marginTop: 8 }}>{placeSub}</span>}
          {d.reading && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 40 }}>
              <span style={{ fontSize: 28, color: C.muted }}>{t.q1}</span>
              <span style={{ fontSize: 64, fontWeight: 700, marginTop: 6, lineHeight: 1.15 }}>{d.reading.text}</span>
              <span style={{ fontSize: 40, marginTop: 6 }}>{d.reading.meaning}</span>
              <span style={{ fontSize: 22, color: C.muted, marginTop: 6 }}>{t.byClaude}</span>
            </div>
          )}
          {d.since && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 36 }}>
              <span style={{ fontSize: 28, color: C.muted }}>{t.q2}</span>
              <span style={{ fontSize: 64, fontWeight: 700, marginTop: 6, color: C.toki }}>{t.since(d.since)}</span>
              <span style={{ fontSize: 22, color: C.muted, marginTop: 6 }}>{t.byCode}</span>
            </div>
          )}
          {gift && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 28, borderLeft: `4px solid ${C.rule}`, paddingLeft: 28 }}>
              <span style={{ fontSize: 32, lineHeight: 1.5 }}>{gift.lang === "ja" ? `「${gift.text}」` : `“${gift.text}”`}</span>
              <span style={{ fontSize: 22, color: C.muted, marginTop: 8 }}>— {gift.title}</span>
            </div>
          )}
          {d.sentence && !gift && !d.since && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 40, borderLeft: `4px solid ${C.rule}`, paddingLeft: 28 }}>
              <span style={{ fontSize: 36, lineHeight: 1.6 }}>{d.sentence.text}</span>
              {d.sentence.source && <span style={{ fontSize: 24, color: C.muted, marginTop: 12 }}>— {d.sentence.source}</span>}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 44, fontSize: 24, color: C.muted }}>
            <span>{t.by}</span>
          </div>
        </div>
      </div>
    ),
    {
      width: W,
      height: H,
      fonts: [
        { name: "Mincho", data: regular, weight: 400, style: "normal" },
        { name: "Mincho", data: bold, weight: 700, style: "normal" },
      ],
      headers: { "cache-control": "private, max-age=300" },
    },
  );
}
