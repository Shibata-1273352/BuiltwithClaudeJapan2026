/**
 * 組紐: the four threads (時 gold, 場 vermilion, 言 light indigo, 間 sakura-nezumi) twisted into one
 * cord — the mark of weaving. Drawn once (≤700 ms, a change of state; none under reduced motion).
 * Colour is the question, so the strands keep their thread colours and nothing glows.
 */
const STRANDS = ["var(--thread-toki)", "var(--thread-ba)", "var(--thread-koto)", "var(--thread-ma)"];

export function Braid({ className = "", turns = 7, vertical = true }: { className?: string; turns?: number; vertical?: boolean }) {
  const L = 400;
  const W = 24;
  const path = (k: number) => {
    let d = "";
    for (let j = 0; j <= 80; j++) {
      const t = j / 80;
      const off = (W / 2 - 3) * Math.sin(2 * Math.PI * turns * t + (k * Math.PI) / 2);
      const a = (t * L).toFixed(1);
      const b = (W / 2 + off).toFixed(1);
      d += `${j ? " L" : "M"} ${vertical ? `${b} ${a}` : `${a} ${b}`}`;
    }
    return d;
  };
  return (
    <svg viewBox={vertical ? `0 0 ${W} ${L}` : `0 0 ${L} ${W}`} preserveAspectRatio="none" className={className} aria-hidden data-testid="braid">
      {STRANDS.map((c, k) => (
        <path key={k} d={path(k)} fill="none" stroke={c} strokeWidth={1.6} strokeLinecap="round" pathLength={1} className="braid-draw" style={{ animationDelay: `${k * 60}ms` }} />
      ))}
    </svg>
  );
}
