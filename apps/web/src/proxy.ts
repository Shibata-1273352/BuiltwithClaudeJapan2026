import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_MAX_AGE_S, COOKIE_NAME, SESSION_COOKIE, decideAccess, isDirectLocal, requestHosts } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const d = decideAccess({
    method: request.method,
    url: request.nextUrl,
    cookieToken: request.cookies.get(COOKIE_NAME)?.value,
    originHeader: request.headers.get("origin"),
    expectedToken: process.env.ACCESS_TOKEN,
    secFetchSite: request.headers.get("sec-fetch-site"),
    allowedHosts: requestHosts(request.headers),
    localBypass: isDirectLocal(process.env.LOCAL_NO_AUTH, request.headers),
  });

  if (d.kind === "allow") {
    const res = NextResponse.next();
    // Per-browser session id: captures and explorations are only visible to the session that made them (ASI06).
    if (!request.cookies.get(SESSION_COOKIE)?.value) {
      res.cookies.set(SESSION_COOKIE, crypto.randomUUID(), {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        path: "/",
        maxAge: COOKIE_MAX_AGE_S,
      });
    }
    return res;
  }

  if (d.kind === "set-cookie-and-redirect") {
    // Next's proxy needs an absolute Location (a relative one throws "Invalid URL"). Build it from the
    // host the browser used (X-Forwarded-Host behind a tunnel, else Host), not the server-side URL.
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
    const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    const res = NextResponse.redirect(new URL(d.location, `${proto}://${host}`), 303);
    res.cookies.set(COOKIE_NAME, d.token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: COOKIE_MAX_AGE_S,
    });
    return res;
  }

  // No internal details in the response (9.4.3).
  const isApi = request.nextUrl.pathname.startsWith("/api/");
  return isApi
    ? NextResponse.json({ error: d.status === 403 ? "forbidden" : "unauthorized" }, { status: d.status })
    : new NextResponse(d.status === 503 ? "Service unavailable" : "Access token required", { status: d.status });
}

export const config = {
  // Everything except Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
