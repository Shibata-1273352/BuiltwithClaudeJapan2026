import { eventsAfter, subscribe, TERMINAL, type StoredEvent } from "@/lib/dag/events";
import { isDemoReplay } from "@/lib/demo";
import { isPresenter } from "@/lib/presenter";
import { replaySchedule } from "@/lib/replay";
import { sessionId } from "@/lib/session";
import { store } from "@/lib/store";

/**
 * Server-Sent Events for one exploration (4.11). Same-origin only (the proxy enforces the cookie).
 * Resumes from Last-Event-ID (or ?after=n). Heartbeats keep tunnels from timing out; buffering is
 * disabled so events are not held back by proxies (4.12).
 */
export async function GET(req: Request, ctx: RouteContext<"/api/explorations/[id]/events">) {
  const { id } = await ctx.params;
  const sid = await sessionId();
  const presenter = await isPresenter(); // read-only presentation mode (FR-46)
  // the one public recording (DEMO_REPLAY_ID) may be replayed by anyone, but only as a recording
  const demo = isDemoReplay(id) && new URL(req.url).searchParams.get("pace") === "replay";
  if ((!sid && !presenter && !demo) || !/^exp_[0-9a-f]{20}$/.test(id)) return new Response(null, { status: 404 });
  const owner = store().prepare("SELECT session_id FROM explorations WHERE id = ?").get(id) as { session_id: string } | undefined;
  if (!owner || (!presenter && !demo && owner.session_id !== sid)) return new Response(null, { status: 404 });

  const url = new URL(req.url);
  const after = Number(req.headers.get("last-event-id") ?? url.searchParams.get("after") ?? 0) || 0;
  const enc = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let last = after;
      let closed = false;
      const send = (e: StoredEvent) => {
        if (closed || e.seq <= last) return;
        last = e.seq;
        controller.enqueue(enc.encode(`id: ${e.seq}\nevent: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`));
        if (TERMINAL.includes(e.type)) close();
      };
      // FR-47 ?pace=replay: the stored events only (never live), with their original pacing
      const paced = url.searchParams.get("pace") === "replay";
      const timers: ReturnType<typeof setTimeout>[] = [];
      const unsub = paced ? () => {} : subscribe(id, send);
      const hb = setInterval(() => !closed && controller.enqueue(enc.encode(`: hb ${Date.now()}\n\n`)), 15_000);
      const close = () => {
        if (closed) return;
        closed = true;
        unsub();
        clearInterval(hb);
        timers.forEach(clearTimeout);
        controller.close();
      };
      cleanup = close;
      controller.enqueue(enc.encode("retry: 2000\n\n"));
      if (paced) {
        const speed = Math.min(4, Math.max(0.5, Number(url.searchParams.get("speed") ?? 1) || 1));
        for (const { at, event } of replaySchedule(eventsAfter(id, after), { speed })) timers.push(setTimeout(() => send(event), at));
      } else for (const e of eventsAfter(id, after)) send(e); // replay (also covers events emitted before subscribe)
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
