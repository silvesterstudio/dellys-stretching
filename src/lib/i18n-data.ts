import type { Locale } from "@/lib/constants";

// Picks the right localized column from a row that has *_ro / *_ru fields.
export function localized<T extends Record<string, unknown>>(
  row: T,
  field: string,
  locale: Locale,
): string {
  const key = `${field}_${locale}`;
  return (row[key] as string) ?? (row[`${field}_ro`] as string) ?? "";
}
