/** FR-45 らぶちゃん (cream lop-eared rabbit): a quiet guide with one non-assertive line. */
export function Guide({ line }: { line: string }) {
  return (
    <aside className="flex items-end gap-3" aria-live="polite" data-testid="guide">
      <svg viewBox="0 0 64 64" width="56" height="56" role="img" aria-label="らぶちゃん" className="shrink-0">
        {/* lop ears */}
        <path d="M18 22 C8 26 6 44 12 50 C16 46 18 36 22 28 Z" fill="#f3e3c3" stroke="#c9b48c" strokeWidth="1.2" />
        <path d="M46 22 C56 26 58 44 52 50 C48 46 46 36 42 28 Z" fill="#f3e3c3" stroke="#c9b48c" strokeWidth="1.2" />
        <path d="M17 30 C13 36 13 43 14 46" stroke="#e9b8b0" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M47 30 C51 36 51 43 50 46" stroke="#e9b8b0" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* head */}
        <ellipse cx="32" cy="34" rx="17" ry="15" fill="#f7ead0" stroke="#c9b48c" strokeWidth="1.2" />
        {/* eyes, nose, cheeks */}
        <circle cx="25.5" cy="33" r="2" fill="#3b2f2a" />
        <circle cx="38.5" cy="33" r="2" fill="#3b2f2a" />
        <path d="M30.5 38 Q32 39.5 33.5 38" stroke="#8a5a4a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        <ellipse cx="32" cy="36.6" rx="1.3" ry="1" fill="#d98a86" />
        <ellipse cx="22" cy="38" rx="2.4" ry="1.4" fill="#f0c4be" opacity="0.8" />
        <ellipse cx="42" cy="38" rx="2.4" ry="1.4" fill="#f0c4be" opacity="0.8" />
      </svg>
      <p className="relative max-w-md rounded-md rounded-bl-sm bg-paper/10 px-4 py-2 text-small leading-relaxed">{line}</p>
    </aside>
  );
}
