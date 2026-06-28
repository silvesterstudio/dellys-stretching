import type { Locale } from "@/lib/constants";

// Picks the right localized column from a row that has *_ro / *_ru fields.
export function localized<T extends Record<string, unknown>>(
  row: T,
  field: string,
  locale: Locale,
): string {
  // Treat an empty string as "missing" so an untranslated *_ru row falls back
  // to *_ro instead of rendering blank.
  const value = row[`${field}_${locale}`] as string | undefined;
  if (value) return value;
  return (row[`${field}_ro`] as string) ?? "";
}
