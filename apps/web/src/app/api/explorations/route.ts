import { getCapture } from "@/lib/captures";
import { startExploration } from "@/lib/explorations/start";
import { sessionId } from "@/lib/session";

/** Start an exploration for one of this session's captures. Returns immediately; progress via SSE. */
export async function POST(req: Request) {
  const sid = await sessionId();
  if (!sid) return Response.json({ error: "no session" }, { status: 401 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const captureId = (body as { capture_id?: unknown })?.capture_id;
  if (typeof captureId !== "string" || !/^cap_[0-9a-f]{20}$/.test(captureId)) return Response.json({ error: "bad capture_id" }, { status: 400 });
  const cap = getCapture(captureId, sid);
  if (!cap) return Response.json({ error: "not_found" }, { status: 404 });
  const r = startExploration(cap, sid);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ exploration_id: r.exploration_id, events: r.events }, { status: 202 });
}
