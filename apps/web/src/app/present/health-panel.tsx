import { connection } from "next/server";
import { getHealth } from "@/lib/health";

export async function HealthPanel() {
  await connection();
  const h = await getHealth();
  const rows: [string, boolean, string][] = [
    ["Evidence Graph（Neo4j）", h.graph.ok, h.graph.ok ? `Entity ${h.graph.entities} 件` : "グラフ未接続"],
    ["推論サーバー", h.inference.ok, h.inference.ok ? `device: ${h.inference.device}` : "空間解析：簡易表示"],
    ["Claude", h.claude.configured, h.claude.model],
  ];
  return (
    <ul className="flex flex-col gap-4">
      {rows.map(([name, ok, detail]) => (
        <li key={name} className="flex items-baseline gap-4">
          <span aria-hidden className={ok ? "text-toki" : "text-muted"}>
            {ok ? "●" : "○"}
          </span>
          <span>{name}</span>
          <span className="text-muted">
            {ok ? "接続" : "未接続"} · {detail}
          </span>
        </li>
      ))}
    </ul>
  );
}
