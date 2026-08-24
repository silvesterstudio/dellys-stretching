import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/constants";

export { LOCALES, DEFAULT_LOCALE };
export type { Locale };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

// The locale is normally absent from the URL (the middleware rewrites `/program`
// onto the `[lang]` segment without touching the address bar), but `/ru/...` is
// a real, crawlable path so Russian stays indexable. Anything comparing the
// current path against a link — active nav states, "am I on the home page?" —
// must therefore compare locale-free paths.
export function stripLocale(pathname: string): string {
  for (const l of LOCALES) {
    if (pathname === `/${l}`) return "/";
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

// A public path as it appears in the address bar for a given locale. Romanian is
// the default and carries no prefix; Russian keeps `/ru` so search engines can
// index it as its own page.
export function localePath(locale: Locale, path: string): string {
  const rest = path === "/" ? "" : path;
  return locale === DEFAULT_LOCALE ? rest || "/" : `/${locale}${rest}`;
}

// hreflang map for a public path, plus the x-default every page should declare.
export function languageAlternates(path: string): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((l) => [l, localePath(l, path)])),
    "x-default": localePath(DEFAULT_LOCALE, path),
  };
}
