import { randomUUID } from "node:crypto";
import { getCapture } from "@/lib/captures";
import { runExploration } from "@/lib/dag/run";
import { checkGuards } from "@/lib/guards";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";

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
  const g = checkGuards();
  if (!g.ok) return Response.json({ error: g.reason }, { status: g.reason === "killed" ? 503 : 429 });

  const id = `exp_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  store()
    .prepare("INSERT INTO explorations (id, capture_id, session_id, status, created_at) VALUES (?,?,?,?,?)")
    .run(id, cap.id, sid, "running", new Date().toISOString());
  void runExploration(id, cap); // background; the DAG enforces its own deadline
  return Response.json({ exploration_id: id, events: `/api/explorations/${id}/events` }, { status: 202 });
}
