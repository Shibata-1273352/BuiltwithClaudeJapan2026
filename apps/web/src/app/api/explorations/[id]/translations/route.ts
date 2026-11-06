import { checkGuards } from "@/lib/guards";
import { toTranslate } from "@/lib/note";
import { loadNote } from "@/lib/note-server";
import { isPresenter } from "@/lib/presenter";
import { sessionId } from "@/lib/session";
import { cachedTranslations, translationsFor } from "@/lib/translate";

/** GET ?lang=ja|en — 参考訳 of the cited originals (FR-42). Generated once per language and cached. */
export async function GET(req: Request, ctx: RouteContext<"/api/explorations/[id]/translations">) {
  const { id } = await ctx.params;
  const presenter = await isPresenter();
  const note = loadNote(id, { sid: await sessionId(), presenter });
  if (!note) return new Response(null, { status: 404 });
  const lang = new URL(req.url).searchParams.get("lang");
  if (lang !== "ja" && lang !== "en") return Response.json({ error: "lang must be ja or en" }, { status: 400 });
  const hit = cachedTranslations(id, lang);
  if (hit) return Response.json({ lang, items: hit, cached: true });
  // read-only, or a recording seen without a key: the originals stand alone
  if (presenter || !process.env.ANTHROPIC_API_KEY) return Response.json({ lang, items: {}, cached: false });
  const g = checkGuards();
  if (!g.ok) return Response.json({ error: g.reason }, { status: g.reason === "killed" ? 503 : 429 });
  const items = await translationsFor(id, lang, toTranslate(note, lang));
  return Response.json({ lang, items, cached: false });
}
