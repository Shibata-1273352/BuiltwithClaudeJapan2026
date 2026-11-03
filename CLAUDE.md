# TSUMUGI — working rules

Requirements: `docs/REQUIREMENTS.md` (the source of truth). Deadline 2026-11-10 14:00 JST.

## Development

- Reply to the user in Japanese. Code, comments, commits and PRs in English.
- Work autonomously. Collect questions for the user and ask them together; when a reasonable
  default exists, take it and say so.
- No destructive or dangerous commands. `.env` is written only by the user — tell them the exact
  line to add.
- Few, large PRs. **Every PR is based on `main`** (a PR stacked on another branch missed main once).
  The user merges; check that a PR is really merged before building on it.
- Before a PR: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`; UI changes are
  checked by screenshots (`scripts/design-shots.ts`, `scripts/stage-shots.ts`, `scripts/rehearse.ts`).
- Cost: report the cost of every live Claude run. Prefer the public recording (`DEMO_REPLAY_ID`)
  for UI checks. The evaluation uses the Batch API and runs once, aggregated, when features are done.
- Never type a number into the UI or docs by hand: compute it from stored results
  (e.g. `lib/eval-summary.ts`).
- Honesty is a feature:
  - Show what Claude produced and what code decided, separately (chips, 舞台裏).
  - Pencil items (viewpoint, associations, visual similarity) never become claims, threads or
    graph nodes.
  - Say what was not done or not measured.

## Design (checked by `apps/web/src/design.test.ts`)

The look is editorial, not dashboard: a night-indigo page where type, hairlines and the photo
carry the structure, and light (lantern, the four threads) appears only where it means something.

1. **Type scale only** — `text-caption` 0.75rem, `text-small` 0.875, `text-body` 1, `text-lead`
   1.25, `text-title` 1.75, `text-display` 3, `text-hero` 4.5 (rem, so presenter mode scales).
   No Tailwind default sizes (`text-xs`, `text-sm`, …) and no `text-[…]` in `src/app`.
   Mincho/Garamond (`font-serif`) for display and reading text; gothic for UI; Klee One
   (`font-hand`) only for pencil.
2. **Structure by space and hairlines, not boxes.** Sections are separated by a hairline rule and
   a caption label (`<Section>`). A filled box is allowed only for a repeatable item (an evidence
   card) or an overlay panel. Never a box inside a box. Callouts use a 2px left rule, no fill.
3. **Two radii** — `rounded-sm` (2px: tags, inputs, buttons) and `rounded-md` (6px: photos, cards,
   panels). `rounded-full` only inside `src/app/ui/` (status dots).
4. **Color has a role.** `paper` text and the primary action, `muted` secondary (≥ 4.5:1 on
   night). `lantern` = "live" (Claude working, the photo anchor) and at most one highlight per view.
   Thread colors (時 gold, 場 vermilion, 言 light indigo, 間 sakura-nezumi) only for thread meaning —
   "absent / not found" is a line style and paper text, never vermilion. Zeros are `muted`. No glow
   or colored shadow outside the thread layer and the photo anchor; no backdrop blur.
5. **Say it once.** One `<Pencil>` marker + one legend per view instead of repeated disclaimers
   (「根拠ではありません」 appears once in `src/app`). No meta-commentary in headings; an
   explanation goes in a caption line below. Labels stay next to line styles (not color alone).
6. **Buttons**: `<Button>` / `<ButtonLink>` — `primary` (paper fill, one per view), `secondary`
   (hairline), `quiet` (text). Rectangular, `min-h-11` touch target.
7. **Motion** only for a change of state (≤ 700 ms, except the deliberate beats of 6.3);
   pulsing only for "live" and the running step; everything respects reduced motion.
8. **Japanese typesetting**: phrases do not break mid-word (`word-break: auto-phrase` on `:lang(ja)`),
   annotations do not wrap; a scroll area that can cut text fades out instead (`.fade-end`).
9. **No debug or raw ids on screen** (fps, layer keys, scores, claim/sentence ids) — they belong
   in 舞台裏 or behind `?debug=1`.
10. Keep every `data-testid` used by the E2E scripts and the list view.
