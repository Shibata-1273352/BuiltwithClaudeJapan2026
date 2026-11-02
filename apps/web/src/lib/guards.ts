/**
 * Exploration guards (FR-05, FR-53, 4.12, 9.4.2 ASI10): kill switch, hourly count, daily spend cap.
 * Checked before every new exploration; running ones finish within their own budget.
 */
import { store } from "./store";

export const LIMITS = { perHour: Number(process.env.EXPLORATIONS_PER_HOUR ?? 30) };

export type GuardResult = { ok: true } | { ok: false; reason: "killed" | "hourly_limit" | "daily_cost" };

export function isKilled(): boolean {
  if (process.env.TSUMUGI_KILL === "1") return true;
  const r = store().prepare("SELECT value FROM settings WHERE key = 'kill'").get() as { value: string } | undefined;
  return r?.value === "1";
}

export function setKill(on: boolean): void {
  store().prepare("INSERT INTO settings (key, value) VALUES ('kill', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(on ? "1" : "0");
}

export function checkGuards(now = new Date()): GuardResult {
  if (isKilled()) return { ok: false, reason: "killed" };
  const db = store();
  const hourAgo = new Date(now.getTime() - 3600_000).toISOString();
  const n = (db.prepare("SELECT count(*) AS n FROM explorations WHERE created_at > ?").get(hourAgo) as { n: number }).n;
  if (n >= LIMITS.perHour) return { ok: false, reason: "hourly_limit" };
  const day = now.toISOString().slice(0, 10);
  const spent = (db.prepare("SELECT coalesce(sum(cost_usd), 0) AS c FROM ai_calls WHERE ts >= ?").get(`${day}T00:00:00`) as { c: number }).c;
  const cap = Number(process.env.DAILY_COST_LIMIT_USD ?? 20);
  if (spent >= cap) return { ok: false, reason: "daily_cost" };
  return { ok: true };
}
