import { LOCALES, DEFAULT_LOCALE, type Locale } from "@/lib/constants";

export { LOCALES, DEFAULT_LOCALE };
export type { Locale };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
