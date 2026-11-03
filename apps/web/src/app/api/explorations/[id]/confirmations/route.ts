import { CONFIRMABLE, setConfirmation, THREAD_ID_RE } from "@/lib/confirmations";
import { loadNote } from "@/lib/note-server";
import { sessionId } from "@/lib/session";

/**
 * POST {thread_id, confirmed} — FR-44: the owner of the exploration confirms (or un-confirms) a
 * pencil / pending thread. Same-origin is enforced by the proxy; the presenter is read-only.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/explorations/[id]/confirmations">) {
  const { id } = await ctx.params;
  const sid = await sessionId();
  if (!sid) return new Response(null, { status: 401 });
  const note = loadNote(id, { sid, presenter: false });
  if (!note) return new Response(null, { status: 404 });
  const body = (await req.json().catch(() => null)) as { thread_id?: unknown; confirmed?: unknown } | null;
  const threadId = body?.thread_id;
  if (typeof threadId !== "string" || !THREAD_ID_RE.test(threadId) || typeof body?.confirmed !== "boolean")
    return Response.json({ error: "bad_request" }, { status: 400 });
  const th = note.threads.find((t) => t.id === threadId);
  if (!th) return Response.json({ error: "unknown thread" }, { status: 404 });
  if (!CONFIRMABLE.has(th.state)) return Response.json({ error: "only pencil or pending threads can be confirmed" }, { status: 409 });
  setConfirmation(id, threadId, sid, body.confirmed);
  return Response.json({ thread_id: threadId, confirmed: body.confirmed });
}
