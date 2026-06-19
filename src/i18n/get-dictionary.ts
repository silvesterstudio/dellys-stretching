import "server-only";
import type { Locale } from "@/lib/constants";
import ro from "./dictionaries/ro.json";
import ru from "./dictionaries/ru.json";

const dictionaries = { ro, ru } as const;

export type Dictionary = typeof ro;

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
