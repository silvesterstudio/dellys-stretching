"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/constants";
import { stripLocale } from "@/i18n/config";

export function LanguageSwitcher({
  current,
  variant = "light",
}: {
  current: Locale;
  // "dark" sits on the dark glass header island; "light" on white surfaces.
  variant?: "light" | "dark";
}) {
  const pathname = usePathname();
  const router = useRouter();

  // The language is a preference, not a destination. Switching it sets a cookie
  // and re-renders the page you are already on — the URL does not change, so
  // nothing is lost: not your place on the page, not a query string, not a
  // half-filled form's route.
  //
  // The one exception is /ru/... — a real path kept crawlable for search. From
  // there we do navigate, to the same page without the prefix, so the cookie
  // becomes the single source of truth from then on.
  function switchTo(next: Locale) {
    if (next === current) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    const bare = stripLocale(pathname);
    if (bare !== pathname) router.push(bare);
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
