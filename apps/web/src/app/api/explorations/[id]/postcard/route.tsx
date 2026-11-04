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
 * GET ?lang=ja|en — the 9:16 postcard (1080×1920): the cut-out, a vermilion seal of the words read
 * from the photo, one sentence that passed the code checks, and the broken thread. No Claude call.
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
      ? { broken: (y: string, permanent: boolean) => `${y}年、${permanent ? "恒久的な" : ""}${d.place?.ja ?? ""}は、まだなかった`, counts: `資料 ${d.counts.sources} · 採用した主張 ${d.counts.claims} · 糸 ${d.counts.threads}`, by: "Claude が読み、コードが確かめた", seal: "写真から読んだ文字" }
      : { broken: (y: string, permanent: boolean) => `In ${y}, ${permanent ? "the permanent " : ""}${shortEn || "it"} was gone`, counts: `${d.counts.sources} sources · ${d.counts.claims} claims kept · ${d.counts.threads} threads`, by: "Read by Claude, checked by code", seal: "words read from the photo" };
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
          {d.seal && (
            <div style={{ position: "absolute", right: 0, bottom: 40, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ display: "flex", flexWrap: "wrap", width: 190, height: 190, background: C.ba, borderRadius: 10, padding: 14, justifyContent: "center", alignContent: "center", transform: "rotate(-4deg)" }}>
                {d.seal.split("").map((ch, i) => (
                  <span key={i} style={{ display: "flex", width: d.seal!.length > 2 ? 81 : 160, height: d.seal!.length > 2 ? 81 : 160, alignItems: "center", justifyContent: "center", fontSize: d.seal!.length > 2 ? 72 : 130, fontWeight: 700, color: C.paper, lineHeight: 1 }}>
                    {ch}
                  </span>
                ))}
              </div>
              <span style={{ marginTop: 14, fontSize: 22, color: C.muted }}>{t.seal}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", flexDirection: "column", borderTop: `2px solid ${C.rule}`, paddingTop: 48 }}>
          <span style={{ fontSize: lang === "ja" ? 120 : 96, fontWeight: 700, lineHeight: 1.05 }}>{placeMain}</span>
          {placeSub && <span style={{ fontSize: 40, color: C.muted, marginTop: 10 }}>{placeSub}</span>}
          {d.broken && (
            <div style={{ display: "flex", alignItems: "center", marginTop: 44, fontSize: 40, color: C.toki }}>
              <div style={{ display: "flex", width: 70, height: 4, marginRight: 22 }}>
                <div style={{ width: 26, height: 4, background: C.toki }} />
                <div style={{ width: 18, height: 4 }} />
                <div style={{ width: 26, height: 4, background: C.toki }} />
              </div>
              <span>{t.broken(d.broken.year, d.broken.interim !== null)}</span>
            </div>
          )}
          {gift && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 28, borderLeft: `4px solid ${C.rule}`, paddingLeft: 28 }}>
              <span style={{ fontSize: 34, lineHeight: 1.5 }}>{gift.lang === "ja" ? `「${gift.text}」` : `“${gift.text}”`}</span>
              <span style={{ fontSize: 24, color: C.muted, marginTop: 8 }}>— {gift.title}</span>
            </div>
          )}
          {d.sentence && !gift && (
            <div style={{ display: "flex", flexDirection: "column", marginTop: 40, borderLeft: `4px solid ${C.rule}`, paddingLeft: 28 }}>
              <span style={{ fontSize: 40, lineHeight: 1.6 }}>{d.sentence.text}</span>
              {d.sentence.source && <span style={{ fontSize: 28, color: C.muted, marginTop: 12 }}>— {d.sentence.source}</span>}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 56, fontSize: 26, color: C.muted }}>
            <span>{t.counts}</span>
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
