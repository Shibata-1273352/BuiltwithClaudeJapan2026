import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./auth";

/** Session id set by proxy.ts. Requests without one are rejected (the proxy issues it on first visit). */
export async function sessionId(): Promise<string | null> {
  const v = (await cookies()).get(SESSION_COOKIE)?.value;
  return v && /^[0-9a-f-]{36}$/.test(v) ? v : null;
}
