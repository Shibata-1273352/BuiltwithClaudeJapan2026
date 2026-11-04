"use client";

import { useState } from "react";
import { LiveStage } from "../../live/live-stage";
import type { Source } from "../../live/use-exploration";

export function ReplayStage({ explorationId, photo, recordedAt, instant = false }: { explorationId: string; photo: string; recordedAt: string; instant?: boolean }) {
  const [source] = useState<Source>(() => ({ kind: "replay", explorationId, photo, recordedAt, instant }));
  return <LiveStage source={source} />;
}
