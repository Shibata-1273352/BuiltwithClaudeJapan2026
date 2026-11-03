"use client";

import { useState } from "react";
import { LiveStage } from "../../live/live-stage";
import type { Source } from "../../live/use-exploration";

export function ReplayStage({ explorationId, photo, recordedAt }: { explorationId: string; photo: string; recordedAt: string }) {
  const [source] = useState<Source>(() => ({ kind: "replay", explorationId, photo, recordedAt }));
  return <LiveStage source={source} />;
}
