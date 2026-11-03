import { saveCapture } from "@/lib/captures";
import { startExploration } from "@/lib/explorations/start";
import { readSample, TRY_SAMPLES } from "@/lib/samples";
import { sessionId } from "@/lib/session";

/**
 * POST {name?} — "例で試す": start a LIVE exploration on an allowlisted CC0 sample photo (no upload).
 * Same capture checks, guards and cost cap as an upload; the capture belongs to this session.
 */
export async function POST(req: Request) {
  const sid = await sessionId();
  if (!sid) return Response.json({ error: "no session" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { name?: unknown; lang?: unknown };
  const name = typeof body.name === "string" ? body.name : "kaminarimon_cc0.jpg";
  if (!TRY_SAMPLES.has(name)) return Response.json({ error: "unknown sample" }, { status: 400 });
  const bytes = await readSample(name);
  if (!bytes) return Response.json({ error: "sample not installed (npm run setup:samples)" }, { status: 503 });
  const cap = await saveCapture({ bytes: new Uint8Array(bytes), sessionId: sid, uiLang: body.lang === "en" ? "en" : "ja" });
  const r = startExploration(cap, sid);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ exploration_id: r.exploration_id, events: r.events, photo: `/api/samples/${name}` }, { status: 202 });
}
