import { readSample } from "@/lib/samples";

/** GET — an allowlisted public-domain / CC0 sample image (corpus/samples.json) for the stage. */
export async function GET(_req: Request, ctx: RouteContext<"/api/samples/[name]">) {
  const { name } = await ctx.params;
  const body = await readSample(name);
  if (!body) return new Response(null, { status: 404 });
  return new Response(new Uint8Array(body), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" },
  });
}
