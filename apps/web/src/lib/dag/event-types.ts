/**
 * Every event type, in one place (no server imports, so client components can use it): the SSE
 * listeners (live stage, list view, presenter, replay) subscribe to exactly this list, so a new
 * event can never be silently dropped by one of them.
 */
export const EVENT_TYPES = [
  "received",
  "stage",
  "see_progress",
  "see",
  "place",
  "plan",
  "candidates",
  "gap",
  "claims",
  "existence",
  "conflicts",
  "threads",
  "names",
  "timeline",
  "space",
  "visual",
  "viewpoint",
  "guide",
  "associations",
  "narrative_progress",
  "narrative",
  "graph",
  "ai_call",
  "notice",
  "done",
  "failed",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];
