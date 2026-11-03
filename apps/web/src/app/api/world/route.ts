import places from "../../../../../../corpus/places.json";
import { entities } from "@/lib/entities-server";
import { worldPoints, type SourcePlace } from "@/lib/world";

/**
 * GET ?entity=ent:kaminarimon&sources=a,b — FR-25: where this run's sources come from, with the
 * distance to the site. Public corpus data only (no exploration content), so no session is needed.
 */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const entity = u.searchParams.get("entity") ?? "";
  const ids = (u.searchParams.get("sources") ?? "").split(",").filter((s) => /^[a-z0-9-]{2,60}$/.test(s)).slice(0, 40);
  const site = entities()
    .ancestors(entity)
    .find((e) => e.coords)?.coords;
  if (!site) return Response.json({ error: "unknown_entity" }, { status: 404 });
  return Response.json({ site, points: worldPoints(ids, places.places as Record<string, SourcePlace[]>, site) });
}
