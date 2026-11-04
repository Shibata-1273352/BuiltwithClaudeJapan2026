import { readCacheFile, type CacheKind } from "@/lib/data-files";
import { demoCaptureId } from "@/lib/demo";
import { isPresenter } from "@/lib/presenter";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";

const KINDS = new Set<CacheKind>(["scenes", "artifacts", "visual"]);

export async function GET(_req: Request, ctx: RouteContext<"/api/cache/[kind]/[id]/[file]">) {
  const { kind, id, file } = await ctx.params;
  if (!KINDS.has(kind as CacheKind)) return new Response(null, { status: 404 });
  // A visitor's own photo (cap_…): only its session, or the read-only presenter (FR-46)
  if (kind === "scenes" && id.startsWith("cap_") && id !== demoCaptureId() && !(await isPresenter())) {
    const sid = await sessionId();
    const own = sid && store().prepare("SELECT 1 FROM captures WHERE id = ? AND session_id = ?").get(id, sid);
    if (!own) return new Response(null, { status: 404 });
  }
  const f = await readCacheFile(kind as CacheKind, id, file);
  if (!f) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(f.body), {
    headers: {
      "Content-Type": f.type,
      "Cache-Control": "private, max-age=300",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
