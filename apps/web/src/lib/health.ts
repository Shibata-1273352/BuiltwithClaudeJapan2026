import { CLAUDE_MODEL } from "./claude";
import { graphHealth } from "./neo4j";

export type Health = {
  graph: { ok: boolean; entities?: number };
  inference: { ok: boolean; device?: string };
  claude: { configured: boolean; model: string };
};

async function inferenceHealth(): Promise<Health["inference"]> {
  const url = process.env.INFERENCE_URL ?? "http://127.0.0.1:8100";
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(2_000), cache: "no-store" });
    if (!r.ok) return { ok: false };
    const j = (await r.json()) as { ok?: unknown; device?: unknown };
    // ASI07: validate the shape before trusting it.
    return j.ok === true && typeof j.device === "string" ? { ok: true, device: j.device } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export async function getHealth(): Promise<Health> {
  const [graph, inference] = await Promise.all([graphHealth(), inferenceHealth()]);
  return { graph, inference, claude: { configured: Boolean(process.env.ANTHROPIC_API_KEY), model: CLAUDE_MODEL } };
}
