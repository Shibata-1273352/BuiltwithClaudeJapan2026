/**
 * Which of the four threads a claim belongs to — colour is the question (CLAUDE.md design 4):
 *   時 toki  gold          when: it burned, it was rebuilt, it stood that year
 *   場 ba    vermilion     where / what: a place described, mentioned, observed
 *   言 koto  light indigo  what was written: the names it was called
 *   間 ma    sakura-nezumi between then and now: a work that depicts the place
 * One function for the run (threads.ts) and for the stage (state.ts), so a stored recording shows
 * the same colours as a live run.
 */
export type Layer = "toki" | "ba" | "koto" | "ma";

export function layerOf(predicate: string | null | undefined): Layer {
  switch (predicate) {
    case "destroyed_in":
    case "rebuilt_in":
    case "built_in":
      return "toki";
    case "named_as":
      return "koto";
    case "depicts":
      return "ma";
    default:
      return "ba"; // describes, mentions, observed, dedicated_to: the place itself
  }
}
