"use client";

import { useState } from "react";
import { LiveStage } from "./live-stage";
import type { Source } from "./use-exploration";

export function SampleStage({ name, demoReplay }: { name: string; demoReplay: string | null }) {
  const [source] = useState<Source>(() => ({ kind: "sample", name }));
  return <LiveStage source={source} demoReplay={demoReplay} />;
}

export function AttachStage({ explorationId, photo, demoReplay }: { explorationId: string; photo: string; demoReplay: string | null }) {
  const [source] = useState<Source>(() => ({ kind: "attach", explorationId, photo }));
  return <LiveStage source={source} demoReplay={demoReplay} />;
}

export function UploadStage({ jpeg, useLocation, onExit }: { jpeg: Blob; useLocation: boolean; onExit: () => void }) {
  const [source] = useState<Source>(() => ({ kind: "upload", jpeg, useLocation }));
  return <LiveStage source={source} onExit={onExit} />;
}
