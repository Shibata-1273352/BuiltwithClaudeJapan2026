import { ask, ASK_PER_HOUR, asksLastHour } from "@/lib/ask";
import { cleanQuestion } from "@/lib/ask-check";
import { eventsAfter } from "@/lib/dag/events";
import { isDemoReplay } from "@/lib/demo";
import { checkGuards } from "@/lib/guards";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";

/**
 * POST { question, lang } — pull the thread (FR-60): Claude answers from this run's passages with
 * native citations; code keeps only citations it can find in the corpus. The owner, or anyone on the
 * public demo recording; at most ASK_PER_HOUR per exploration, under the daily cost cap and kill switch.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/explorations/[id]/ask">) {
  const { id } = await ctx.params;
  if (!/^exp_[0-9a-f]{20}$/.test(id)) return new Response(null, { status: 404 });
  const sid = await sessionId();
  const row = store().prepare("SELECT session_id, status FROM explorations WHERE id = ?").get(id) as { session_id: string; status: string } | undefined;
  if (!row || (!(sid && row.session_id === sid) && !isDemoReplay(id))) return new Response(null, { status: 404 });
  if (row.status !== "done") return Response.json({ error: "not_ready" }, { status: 409 });
  const body = (await req.json().catch(() => null)) as { question?: unknown; lang?: unknown } | null;
  const question = cleanQuestion(body?.question);
  if (!question) return Response.json({ error: "question must be 2–200 characters" }, { status: 400 });
  const lang = body?.lang === "en" ? "en" : "ja";
  const g = checkGuards();
  if (!g.ok) return Response.json({ error: g.reason }, { status: g.reason === "killed" ? 503 : 429 });
  if (asksLastHour(id) >= ASK_PER_HOUR) return Response.json({ error: "hourly_limit" }, { status: 429 });
  const placeEv = eventsAfter(id, 0).find((e) => e.type === "place")?.data as { chosen?: { path?: { name: { ja: string; en: string } }[] } | null } | undefined;
  const name = placeEv?.chosen?.path?.[0]?.name;
  try {
    const r = await ask(id, question, lang, name ? `${name.ja} / ${name.en}` : "");
    return Response.json({ question, lang, ...r.answer, passages: r.passages, costUsd: r.record?.costUsd ?? 0, elapsedMs: r.record?.elapsedMs ?? 0, model: r.record?.servedModel ?? null });
  } catch (e) {
    console.error(`[ask ${id}]`, e);
    return Response.json({ error: "ask_failed" }, { status: 502 });
  }
}
