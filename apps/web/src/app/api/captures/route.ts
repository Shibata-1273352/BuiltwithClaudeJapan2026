import { purgeExpired, saveCapture } from "@/lib/captures";
import { UploadError, UPLOAD_LIMITS } from "@/lib/jpeg";
import { sessionId } from "@/lib/session";

/** FR-01..04: receive the on-device processed JPEG (multipart field "image"), optional lat/lon/lang. */
export async function POST(req: Request) {
  const sid = await sessionId();
  if (!sid) return Response.json({ error: "no session" }, { status: 401 });
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > UPLOAD_LIMITS.maxBytes + 64 * 1024) return Response.json({ error: "too_large" }, { status: 413 });
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const file = form.get("image");
  if (!(file instanceof Blob)) return Response.json({ error: "image required" }, { status: 400 });
  if (file.size > UPLOAD_LIMITS.maxBytes) return Response.json({ error: "too_large" }, { status: 413 });
  try {
    const cap = await saveCapture({
      bytes: new Uint8Array(await file.arrayBuffer()),
      sessionId: sid,
      lat: form.get("lat"),
      lon: form.get("lon"),
      uiLang: form.get("lang"),
    });
    void purgeExpired().catch(() => undefined); // opportunistic FR-51 cleanup
    return Response.json(
      { capture_id: cap.id, width: cap.width, height: cap.height, location: cap.lat != null ? "received" : "none" },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof UploadError) {
      return Response.json({ error: e.code }, { status: e.code === "too_large" ? 413 : 415 });
    }
    return Response.json({ error: "internal" }, { status: 500 }); // no internal details (9.4.3)
  }
}
