/** FR-58: a gallery print with the region that matched the photo's lantern outlined (similarity, not evidence). */
export type VisualHit = { id: string; title: string; commons: string; score: number; file: string; crop?: string; box?: number[] };

export function VisualHitCard({ h, width = "w-32" }: { h: VisualHit; width?: string }) {
  const [x1, y1, x2, y2] = h.box ?? [0, 0, 1, 1];
  const whole = x2 - x1 > 0.95 && y2 - y1 > 0.95;
  return (
    <li className={`${width} shrink-0 text-xs`}>
      <a href={h.commons} target="_blank" rel="noreferrer noopener" className="relative block">
        {/* eslint-disable-next-line @next/next/no-img-element -- public-domain gallery thumbnail */}
        <img src={`/api/cache/visual/images/${h.file}`} alt={h.title} className="block h-auto w-full rounded" />
        {!whole && (
          <span
            aria-hidden
            className="absolute rounded-sm border-2 border-lantern shadow-[0_0_8px_var(--lantern)]"
            style={{ left: `${x1 * 100}%`, top: `${y1 * 100}%`, width: `${(x2 - x1) * 100}%`, height: `${(y2 - y1) * 100}%` }}
          />
        )}
      </a>
      <span className="mt-1 block leading-snug">{h.title}</span>
      <span className="text-muted tabular-nums">
        類似度 {h.score.toFixed(2)}
        {h.crop?.startsWith("sam") ? " ・提灯どうし" : ""}
      </span>
    </li>
  );
}
