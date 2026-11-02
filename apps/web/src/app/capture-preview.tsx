"use client";

/**
 * Day-1 placeholder for screen 1 "かざす": pick/take a photo and preview it locally.
 * The image never leaves the device here. Resize, EXIF removal and face blur (FR-02/03) come on 11/3.
 */
import { useEffect, useState } from "react";

export function CapturePreview() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  return (
    <section className="flex w-full max-w-xl flex-col items-center gap-4">
      <label className="flex min-h-11 cursor-pointer items-center rounded-full bg-lantern px-8 py-3 font-bold text-night">
        写真を撮る・選ぶ
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setUrl(URL.createObjectURL(f));
          }}
        />
      </label>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview
        <img src={url} alt="送信前のプレビュー" className="max-h-[70vh] w-auto rounded-lg" />
      ) : (
        <p className="text-sm text-muted">写真は端末の中でだけ表示されます（まだ送信しません）。</p>
      )}
    </section>
  );
}
