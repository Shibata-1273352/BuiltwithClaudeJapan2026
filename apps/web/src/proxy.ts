import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_MAX_AGE_S, COOKIE_NAME, decideAccess } from "@/lib/auth";

export function proxy(request: NextRequest) {
  const d = decideAccess({
    method: request.method,
    url: request.nextUrl,
    cookieToken: request.cookies.get(COOKIE_NAME)?.value,
    originHeader: request.headers.get("origin"),
    expectedToken: process.env.ACCESS_TOKEN,
  });

  if (d.kind === "allow") return NextResponse.next();

  if (d.kind === "set-cookie-and-redirect") {
    const res = NextResponse.redirect(d.location);
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
