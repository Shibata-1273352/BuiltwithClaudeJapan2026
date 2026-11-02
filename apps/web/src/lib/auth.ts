/**
 * Access control (FR-05, REQUIREMENTS.md 4.12, 9.4.3).
 * Pure decision function so it can be unit-tested without Next.js.
 *
 *  - First visit: /?token=<ACCESS_TOKEN> -> set HttpOnly/Secure/SameSite=Strict cookie, redirect without token
 *  - Afterwards: cookie must match
 *  - State-changing API calls must come from the same origin (no CORS)
 */

export const COOKIE_NAME = "tsumugi_token";
export const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 7;

export type AuthInput = {
  method: string;
  url: URL;
  cookieToken: string | undefined;
  originHeader: string | null;
  expectedToken: string | undefined;
};

export type AuthDecision =
  | { kind: "allow" }
  | { kind: "set-cookie-and-redirect"; location: string; token: string }
  | { kind: "deny"; status: 401 | 403 | 503; reason: string };

/** Constant-time string comparison (no node:crypto needed). */
export function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function decideAccess(i: AuthInput): AuthDecision {
  if (!i.expectedToken || i.expectedToken.length < 16) {
    return { kind: "deny", status: 503, reason: "ACCESS_TOKEN not configured" };
  }

  const queryToken = i.url.searchParams.get("token");
  if (queryToken !== null && SAFE_METHODS.has(i.method)) {
    if (!safeEqual(queryToken, i.expectedToken)) return { kind: "deny", status: 401, reason: "invalid token" };
    const clean = new URL(i.url);
    clean.searchParams.delete("token");
    return { kind: "set-cookie-and-redirect", location: clean.toString(), token: queryToken };
  }

  if (!i.cookieToken || !safeEqual(i.cookieToken, i.expectedToken)) {
    return { kind: "deny", status: 401, reason: "missing or invalid token" };
  }

  if (!SAFE_METHODS.has(i.method)) {
    if (!i.originHeader || i.originHeader !== i.url.origin) {
      return { kind: "deny", status: 403, reason: "cross-origin request" };
    }
  }
  return { kind: "allow" };
}
