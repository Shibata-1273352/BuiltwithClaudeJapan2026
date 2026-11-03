"use client";

/**
 * Screen 1 "かざす": take/pick a photo → on-device resize, EXIF removal, face mosaic → preview
 * with manual extra blur and retake (FR-01..03), optional location (FR-04), then send and follow
 * the exploration live. If preprocessing fails, sending stays disabled (fail closed).
 */
import { useEffect, useRef, useState } from "react";
import { boxAround, type Box } from "@/lib/capture/geometry";
import { prepare, render, toJpeg, type Prepared } from "@/lib/capture/preprocess";
import { ExplorationView } from "./exploration-view";
import { dict, useDict } from "./i18n";
import { UploadStage } from "./live/sample-stage";
import { Button, buttonClass } from "./ui/button";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "ready"; prepared: Prepared; manual: Box[]; debug: boolean }
  | { kind: "error"; message: string };

const T = dict({
  ja: {
    failed: "処理に失敗しました",
    retake: "撮り直す",
    take: "写真を撮る・選ぶ",
    working: "端末の中で縮小・顔のぼかしをしています…",
    error: (m: string) => `前処理に失敗したため送信できません（${m}）。撮り直してください。`,
    preview: "送信前のプレビュー。ぼかしたい所をタップすると追加でぼかします。",
    faces: (n: number, manual: number) =>
      `顔を ${n} 件検出してぼかしました${manual ? `（手動で ${manual} 件追加）` : ""}。 検出漏れはあり得ます。気になる所はタップして追加でぼかしてください。`,
    send: "この写真で紡ぐ",
    undo: "手動のぼかしを1つ戻す",
    sending: (w: number, h: number, kb: number) => `送信するもの：${w}×${h}・${kb} KB・EXIF なし`,
    location: "位置情報を使う（許可した場合のみ、座標だけを送ります）",
    jpeg: "送信用JPEG",
  },
  en: {
    failed: "Processing failed",
    retake: "Retake",
    take: "Take or choose a photo",
    working: "Resizing and blurring faces on your device…",
    error: (m: string) => `Preprocessing failed, so nothing can be sent (${m}). Please take the photo again.`,
    preview: "Preview before sending. Tap anywhere to blur it as well.",
    faces: (n: number, manual: number) =>
      `${n} face${n === 1 ? "" : "s"} found and blurred${manual ? ` (${manual} added by hand)` : ""}. Some may be missed — tap anything you want blurred.`,
    send: "Weave with this photo",
    undo: "Undo one manual blur",
    sending: (w: number, h: number, kb: number) => `What is sent: ${w}×${h} · ${kb} KB · no EXIF`,
    location: "Use my location (only if you allow it; only the coordinates are sent)",
    jpeg: "JPEG to send",
  },
});

export function CapturePreview() {
  const t = useDict(T);
  const [state, setState] = useState<State>({ kind: "idle" });
  const [jpeg, setJpeg] = useState<{ bytes: number; url: string; blob: Blob } | null>(null);
  const [sent, setSent] = useState<Blob | null>(null);
  const [asList, setAsList] = useState(false); // 6.4 ?view=list: the accessible list instead of the stage
  const [useLocation, setUseLocation] = useState(false);
  const out = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (state.kind !== "ready" || !out.current) return;
    render(state.prepared.canvas, [...state.prepared.faces, ...state.manual], out.current);
    let url: string | null = null;
    toJpeg(out.current).then((b) => {
      url = URL.createObjectURL(b);
      setJpeg({ bytes: b.size, url, blob: b });
    });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [state]);

  async function onFile(f: File | undefined) {
    if (!f) return;
    setJpeg(null);
    setSent(null);
    setState({ kind: "working" });
    try {
      const prepared = await prepare(f);
      // ?debug=1 exposes raw detections on the page for threshold tuning (local only; never sent).
      setState({ kind: "ready", prepared, manual: [], debug: new URLSearchParams(location.search).has("debug") });
    } catch (e) {
      setState({ kind: "error", message: e instanceof Error ? e.message : t.failed });
    }
  }

  function onTap(e: React.PointerEvent<HTMLCanvasElement>) {
    if (state.kind !== "ready") return;
    const r = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * state.prepared.width;
    const y = ((e.clientY - r.top) / r.height) * state.prepared.height;
    setState({ ...state, manual: [...state.manual, boxAround(x, y, state.prepared.width, state.prepared.height)] });
  }

  return (
    <section className="flex w-full flex-col items-start gap-4">
      <label className={buttonClass("secondary", "cursor-pointer")}>
        {state.kind === "ready" ? t.retake : t.take}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          data-testid="file-input"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      {state.kind === "working" && <p className="text-muted">{t.working}</p>}
      {state.kind === "error" && (
        <p role="alert" className="text-ba">
          {t.error(state.message)}
        </p>
      )}

      {state.kind === "ready" && (
        <>
          <canvas
            ref={out}
            onPointerDown={onTap}
            className="max-h-[65vh] w-auto max-w-full cursor-crosshair touch-none rounded-md"
            aria-label={t.preview}
            data-testid="preview"
          />
          <p
            className="text-small text-muted"
            data-testid="faces"
            data-raw={state.debug ? JSON.stringify(state.prepared.raw) : undefined}
          >
            {t.faces(state.prepared.faces.length, state.manual.length)}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              disabled={!jpeg || Boolean(sent)}
              onClick={() => {
                if (!jpeg) return;
                setAsList(new URLSearchParams(location.search).get("view") === "list");
                setSent(jpeg.blob);
              }}
              data-testid="send"
            >
              {t.send}
            </Button>
            {state.manual.length > 0 && (
              <Button variant="quiet" onClick={() => setState({ ...state, manual: state.manual.slice(0, -1) })}>
                {t.undo}
              </Button>
            )}
          </div>
          {jpeg && (
            <p className="text-caption text-muted tabular-nums">
              {t.sending(state.prepared.width, state.prepared.height, Math.round(jpeg.bytes / 1024))}
            </p>
          )}
          <label className="flex min-h-11 items-center gap-2 text-small">
            <input
              type="checkbox"
              checked={useLocation}
              disabled={Boolean(sent)}
              onChange={(e) => setUseLocation(e.target.checked)}
              className="size-5"
            />
            {t.location}
          </label>
          {jpeg && <a href={jpeg.url} download="tsumugi-upload.jpg" data-testid="jpeg-link" className="sr-only">{t.jpeg}</a>}
        </>
      )}

      {sent && asList && <ExplorationView jpeg={sent} useLocation={useLocation} />}
      {/* the live stage takes the whole screen once the photo is sent */}
      {sent && !asList && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-night">
          <UploadStage jpeg={sent} useLocation={useLocation} onExit={() => setSent(null)} />
        </div>
      )}

    </section>
  );
}
