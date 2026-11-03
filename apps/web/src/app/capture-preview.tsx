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
import { UploadStage } from "./live/sample-stage";

type State =
  | { kind: "idle" }
  | { kind: "working" }
  | { kind: "ready"; prepared: Prepared; manual: Box[]; debug: boolean }
  | { kind: "error"; message: string };

export function CapturePreview() {
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
      setState({ kind: "error", message: e instanceof Error ? e.message : "処理に失敗しました" });
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
    <section className="flex w-full max-w-xl flex-col items-center gap-4">
      <label className="flex min-h-11 cursor-pointer items-center rounded-full bg-lantern px-8 py-3 font-bold text-night">
        {state.kind === "ready" ? "撮り直す" : "写真を撮る・選ぶ"}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          data-testid="file-input"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      {state.kind === "working" && <p className="text-muted">端末の中で縮小・顔のぼかしをしています…</p>}
      {state.kind === "error" && (
        <p role="alert" className="text-ba">
          前処理に失敗したため送信できません（{state.message}）。撮り直してください。
        </p>
      )}

      {state.kind === "ready" && (
        <>
          <canvas
            ref={out}
            onPointerDown={onTap}
            className="max-h-[65vh] w-auto max-w-full cursor-crosshair touch-none rounded-lg"
            aria-label="送信前のプレビュー。ぼかしたい所をタップすると追加でぼかします。"
            data-testid="preview"
          />
          <p
            className="text-sm text-muted"
            data-testid="faces"
            data-raw={state.debug ? JSON.stringify(state.prepared.raw) : undefined}
          >
            顔を {state.prepared.faces.length} 件検出してぼかしました
            {state.manual.length ? `（手動で ${state.manual.length} 件追加）` : ""}。
            検出漏れはあり得ます。気になる所はタップして追加でぼかしてください。
          </p>
          <div className="flex gap-3">
            {state.manual.length > 0 && (
              <button
                type="button"
                className="min-h-11 rounded-full border border-muted px-5"
                onClick={() => setState({ ...state, manual: state.manual.slice(0, -1) })}
              >
                手動のぼかしを1つ戻す
              </button>
            )}
            <button
              type="button"
              disabled={!jpeg || Boolean(sent)}
              onClick={() => {
                if (!jpeg) return;
                setAsList(new URLSearchParams(location.search).get("view") === "list");
                setSent(jpeg.blob);
              }}
              className="min-h-11 rounded-full bg-toki px-6 font-bold text-night disabled:opacity-40"
              data-testid="send"
            >
              この写真で紡ぐ {jpeg ? `（${state.prepared.width}×${state.prepared.height}, ${Math.round(jpeg.bytes / 1024)}KB）` : ""}
            </button>
          </div>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={useLocation}
              disabled={Boolean(sent)}
              onChange={(e) => setUseLocation(e.target.checked)}
              className="size-5"
            />
            位置情報を使う（許可した場合のみ、座標だけを送ります）
          </label>
          {jpeg && <a href={jpeg.url} download="tsumugi-upload.jpg" data-testid="jpeg-link" className="sr-only">送信用JPEG</a>}
        </>
      )}

      {sent && asList && <ExplorationView jpeg={sent} useLocation={useLocation} />}
      {/* the live stage takes the whole screen once the photo is sent */}
      {sent && !asList && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-night">
          <UploadStage jpeg={sent} useLocation={useLocation} />
        </div>
      )}

      {state.kind === "idle" && (
        <p className="text-sm text-muted">写真は端末の中で縮小・位置情報の除去・顔のぼかしをしてから送ります。</p>
      )}
    </section>
  );
}
