import type { Locale } from "@/lib/constants";
import type { Database } from "@/lib/types";

// Client-safe half of the location helpers: the type, the cookie name and pure
// formatting. Anything that touches Supabase or next/headers lives in
// locations-server.ts so this module can be imported from client components.

export type Location = Pick<
  Database["public"]["Tables"]["locations"]["Row"],
  "id" | "key" | "name" | "address_ro" | "address_ru" | "phone" | "maps_url" | "sort_order"
>;

// Which gym the visitor last chose. Not security-sensitive — it only decides
// which schedule is shown first; every write re-derives the location server-side.
export const LOCATION_COOKIE = "dellys_loc";

export function localizedAddress(loc: Location, lang: Locale): string {
  return (lang === "ru" ? loc.address_ru : loc.address_ro) || loc.address_ro;
}
