/**
 * Access control (FR-05, REQUIREMENTS.md 4.12, 9.4.3).
 * Pure decision function so it can be unit-tested without Next.js.
 *
 *  - First visit: /?token=<ACCESS_TOKEN> -> set HttpOnly/Secure/SameSite=Strict cookie, redirect without token
 *  - Afterwards: cookie must match
 *  - State-changing API calls must come from the same origin (no CORS)
 */

export const COOKIE_NAME = "tsumugi_token";
export const SESSION_COOKIE = "tsumugi_sid";
export const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 7;

export type AuthInput = {
  method: string;
  url: URL;
  cookieToken: string | undefined;
  originHeader: string | null;
  expectedToken: string | undefined;
  /** Browser-set Fetch Metadata header; cannot be forged by another site. */
  secFetchSite?: string | null;
  /** Hosts this request was addressed to (Host, X-Forwarded-Host) plus configured public origins. */
  allowedHosts?: string[];
  /** LOCAL_NO_AUTH: a direct local request (see isDirectLocal) may skip the token. */
  localBypass?: boolean;
};

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const LOOPBACK_IPS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
/** Headers only a tunnel / CDN / reverse proxy adds; any of them means "not direct". */
const PROXY_ONLY_HEADERS = ["forwarded", "x-real-ip", "cf-connecting-ip", "cf-ray", "cdn-loop", "true-client-ip"];
const hostOnly = (h: string | null) => (h ?? "").toLowerCase().trim().replace(/:\d+$/, "");

/**
 * A request typed into a browser on this machine: opted in (LOCAL_NO_AUTH=1), addressed to a
 * loopback host, and coming from a loopback address. Next itself fills X-Forwarded-Host (= Host)
 * and X-Forwarded-For (= the socket's address) when they are missing, so those may be present but
 * must be loopback. A tunnel (cloudflared) also connects from localhost, but it addresses the
 * public host, puts the real client in X-Forwarded-For and adds Cf-* headers — it never qualifies,
 * so the public URL always needs the token.
 */
export function isDirectLocal(enabled: string | undefined, headers: Headers): boolean {
  if (enabled !== "1") return false;
  if (!LOCAL_HOSTS.has(hostOnly(headers.get("host")))) return false;
  const fwdHost = headers.get("x-forwarded-host");
  if (fwdHost !== null && !fwdHost.split(",").every((h) => LOCAL_HOSTS.has(hostOnly(h)))) return false;
  const fwdFor = headers.get("x-forwarded-for");
  if (fwdFor !== null && !fwdFor.split(",").every((ip) => LOOPBACK_IPS.has(ip.trim()))) return false;
  return PROXY_ONLY_HEADERS.every((h) => !headers.has(h));
}

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
    // Relative Location: behind a tunnel the server-side URL is localhost, not the public host.
    return { kind: "set-cookie-and-redirect", location: clean.pathname + clean.search, token: queryToken };
  }

  // A direct local request skips only the token; state changes still need the same origin (below).
  if (!i.localBypass && (!i.cookieToken || !safeEqual(i.cookieToken, i.expectedToken))) {
    return { kind: "deny", status: 401, reason: "missing or invalid token" };
  }

  if (!SAFE_METHODS.has(i.method) && !isSameOrigin(i)) {
    return { kind: "deny", status: 403, reason: "cross-origin request" };
  }
  return { kind: "allow" };
}

/**
 * Same-origin check that also works behind a reverse proxy / HTTPS tunnel, where the server-side
 * URL is localhost but the browser's Origin is the public host.
 * 1. Fetch Metadata: if the browser says Sec-Fetch-Site, it must be "same-origin".
 * 2. Otherwise the Origin's host must be one of the hosts the request was addressed to.
 */
export function isSameOrigin(i: AuthInput): boolean {
  if (i.secFetchSite) return i.secFetchSite === "same-origin";
  if (!i.originHeader) return false;
  let host: string;
  try {
    host = new URL(i.originHeader).host.toLowerCase();
  } catch {
    return false;
  }
  return (i.allowedHosts ?? []).some((h) => h.toLowerCase() === host);
}

/** Hosts a request is addressed to: Host, X-Forwarded-Host, and PUBLIC_ORIGINS (comma-separated URLs). */
export function requestHosts(headers: { get(name: string): string | null }, publicOrigins = process.env.PUBLIC_ORIGINS ?? ""): string[] {
  const out = [headers.get("host"), headers.get("x-forwarded-host")?.split(",")[0]?.trim() ?? null];
  for (const o of publicOrigins.split(",").map((s) => s.trim()).filter(Boolean)) {
    try {
      out.push(new URL(o).host);
    } catch {
      /* ignore malformed */
    }
  }
  return out.filter((h): h is string => Boolean(h));
}
