/**
 * Buttons (CLAUDE.md design 6): primary = the one lantern action of a view, secondary = hairline,
 * quiet = text. Rectangular, 44px touch target.
 */
import Link from "next/link";
import type { ComponentProps } from "react";

export type Variant = "primary" | "secondary" | "quiet";

const BASE = "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 whitespace-nowrap text-small font-medium transition-colors disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lantern";
const V: Record<Variant, string> = {
  primary: "bg-lantern text-night hover:bg-[color-mix(in_srgb,var(--lantern)_88%,white)]",
  secondary: "border border-rule-strong text-paper hover:border-paper/60",
  quiet: "px-2 text-paper underline decoration-rule-strong underline-offset-4 hover:decoration-paper",
};

export const buttonClass = (v: Variant = "secondary", extra = "") => `${BASE} ${V[v]} ${extra}`;

export function Button({ variant = "secondary", className = "", ...p }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button type="button" className={buttonClass(variant, className)} {...p} />;
}

export function ButtonLink({ variant = "secondary", className = "", href, ...p }: ComponentProps<"a"> & { variant?: Variant; href: string }) {
  if (href.startsWith("/") && !href.startsWith("/api/")) return <Link href={href} className={buttonClass(variant, className)} {...p} />;
  return <a href={href} className={buttonClass(variant, className)} {...p} />;
}
