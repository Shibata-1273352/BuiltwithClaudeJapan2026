import { isPresenter } from "@/lib/presenter";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";

/** Latest exploration: the presenter sees all sessions (read-only); others only their own. */
export async function GET() {
  const presenter = await isPresenter();
  const sid = await sessionId();
  if (!presenter && !sid) return Response.json({ error: "no session" }, { status: 401 });
  const row = (
    presenter
      ? store().prepare("SELECT id, status, created_at FROM explorations ORDER BY created_at DESC LIMIT 1").get()
      : store().prepare("SELECT id, status, created_at FROM explorations WHERE session_id = ? ORDER BY created_at DESC LIMIT 1").get(sid)
  ) as { id: string; status: string; created_at: string } | undefined;
  return Response.json(row ? { exploration_id: row.id, status: row.status, created_at: row.created_at } : { exploration_id: null });
}
