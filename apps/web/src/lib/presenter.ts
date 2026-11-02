/**
 * Presenter access (FR-46). Explorations are bound to the session that made them (ASI06); the
 * presenter's desktop is a different browser from the phone that shoots. A separate
 * PRESENTER_TOKEN grants READ-ONLY access to the latest explorations for presentation mode.
 */
import { cookies } from "next/headers";
import { safeEqual } from "./auth";

export const PRESENTER_COOKIE = "tsumugi_presenter";

export function presenterTokenOk(value: string | undefined | null): boolean {
  const t = process.env.PRESENTER_TOKEN;
  return Boolean(t && t.length >= 16 && value && safeEqual(value, t));
}

export async function isPresenter(): Promise<boolean> {
  return presenterTokenOk((await cookies()).get(PRESENTER_COOKIE)?.value);
}
