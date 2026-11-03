import { isDemoReplay } from "@/lib/demo";
import { checkGuards } from "@/lib/guards";
import { cachedNarrative, narrativeFor } from "@/lib/narrative-service";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";

/** GET ?lang=ja|en — the narrative in that language; generated once and cached (FR-40, RAG-08). */
export async function GET(req: Request, ctx: RouteContext<"/api/explorations/[id]/narrative">) {
  const { id } = await ctx.params;
  const sid = await sessionId();
  if (!/^exp_[0-9a-f]{20}$/.test(id)) return new Response(null, { status: 404 });
  const row = store().prepare("SELECT session_id, status FROM explorations WHERE id = ?").get(id) as { session_id: string; status: string } | undefined;
  const owner = Boolean(sid && row && row.session_id === sid);
  if (!row || (!owner && !isDemoReplay(id))) return new Response(null, { status: 404 });
  const lang = new URL(req.url).searchParams.get("lang");
  if (lang !== "ja" && lang !== "en") return Response.json({ error: "lang must be ja or en" }, { status: 400 });
  // the public recording reads only what is already cached: a visitor never triggers a Claude call on it
  if (!owner && !cachedNarrative(id, lang)) return Response.json({ error: "not_ready" }, { status: 409 });
  if (!cachedNarrative(id, lang)) {
    const g = checkGuards(); // generating costs a Claude call
    if (!g.ok) return Response.json({ error: g.reason }, { status: g.reason === "killed" ? 503 : 429 });
  }
  const r = await narrativeFor(id, lang);
  if (!r) return Response.json({ error: "not_ready" }, { status: 409 });
  return Response.json({ ...r.payload, cached: r.cached });
}
