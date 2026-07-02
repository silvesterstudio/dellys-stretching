"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/constants";

// Built from LOCALES so adding a locale doesn't require touching this regex.
const LOCALE_PREFIX = new RegExp(`^/(${LOCALES.join("|")})(?=/|$)`);

export function LanguageSwitcher({
  current,
  variant = "light",
}: {
  current: Locale;
  // "dark" sits on the dark glass header island; "light" on white surfaces.
  variant?: "light" | "dark";
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === current) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    // Replace the leading /<locale> segment, preserving the rest AND the query
    // string (e.g. /ro/login?session=… must keep ?session when switching).
    const rest = pathname.replace(LOCALE_PREFIX, "");
    const qs = searchParams.toString();
    router.push(`/${next}${rest || ""}${qs ? `?${qs}` : ""}`);
    router.refresh();
  }

  const dark = variant === "dark";
  return (
    <div
      className={
        dark
          ? "inline-flex rounded-full border border-white/20 bg-white/10 p-0.5 text-xs font-medium"
          : "inline-flex rounded-full border border-mauve-200 bg-white p-0.5 text-xs font-medium"
      }
    >
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={
            l === current
              ? "rounded-full bg-brand-600 px-3 py-1 text-white"
              : dark
                ? "rounded-full px-3 py-1 text-white/70 hover:text-white"
                : "rounded-full px-3 py-1 text-mauve-600 hover:text-mauve-900"
          }
          aria-current={l === current}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
