"use client";

/** The pencil marker's word in the reader's language (鉛筆 / pencil). */
import { useLang } from "../i18n";

export function PencilWord() {
  return <>{useLang() === "en" ? "pencil" : "鉛筆"}</>;
}
