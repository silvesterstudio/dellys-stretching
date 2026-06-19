"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES, type Locale } from "@/lib/constants";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(next: Locale) {
    if (next === current) return;
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    // Replace the leading /<locale> segment with the new locale.
    const rest = pathname.replace(/^\/(ro|ru)(?=\/|$)/, "");
    router.push(`/${next}${rest || ""}`);
    router.refresh();
  }

  return (
    <div className="inline-flex rounded-full border border-mauve-200 bg-white p-0.5 text-xs font-medium">
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          className={
            l === current
              ? "rounded-full bg-brand-500 px-3 py-1 text-white"
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
