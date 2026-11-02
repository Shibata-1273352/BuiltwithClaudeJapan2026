import { COOKIE_MAX_AGE_S } from "@/lib/auth";
import { PRESENTER_COOKIE, presenterTokenOk } from "@/lib/presenter";

/** GET /api/presenter?key=<PRESENTER_TOKEN> -> presenter cookie, then to /present (relative redirect). */
export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!presenterTokenOk(key)) return new Response("Forbidden", { status: 403 });
  const secure = "Secure; ";
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/present",
      "Set-Cookie": `${PRESENTER_COOKIE}=${encodeURIComponent(key!)}; Path=/; HttpOnly; ${secure}SameSite=Strict; Max-Age=${COOKIE_MAX_AGE_S}`,
    },
  });
}
