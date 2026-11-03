"use client";

import { useEffect } from "react";

/** Warms the inference models when the page opens (see /api/warm). Renders nothing. */
export function Warm() {
  useEffect(() => {
    void fetch("/api/warm", { method: "POST" }).catch(() => {});
  }, []);
  return null;
}
