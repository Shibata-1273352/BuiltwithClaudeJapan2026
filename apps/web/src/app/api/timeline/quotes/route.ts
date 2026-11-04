import { eventQuotes } from "@/lib/timeline-quotes-server";

/**
 * GET ?entity=ent:kaminarimon — each reviewed-timeline event's own evidence, verbatim, with its
 * source's title and language. Public corpus data only (no exploration content), so no session is needed.
 */
export async function GET(req: Request) {
  const entity = new URL(req.url).searchParams.get("entity") ?? "";
  if (!/^ent:[a-z0-9-]{2,60}$/.test(entity)) return Response.json({ error: "bad_entity" }, { status: 400 });
  return Response.json({ entity, quotes: eventQuotes(entity) });
}
