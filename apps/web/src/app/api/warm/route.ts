/**
 * POST — ask the inference server to load its models now (a visitor opened the app), so the first
 * exploration does not wait for loading. Fire-and-forget; at most once a minute per server.
 */
let last = 0;

export async function POST() {
  const now = Date.now();
  if (now - last < 60_000) return Response.json({ ok: true, skipped: true });
  last = now;
  const url = process.env.INFERENCE_URL ?? "http://127.0.0.1:8100";
  const token = process.env.INFERENCE_TOKEN;
  if (!token) return Response.json({ ok: false }, { status: 503 });
  try {
    const r = await fetch(`${url}/warm`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(3000) });
    return Response.json({ ok: r.ok });
  } catch {
    return Response.json({ ok: false });
  }
}
