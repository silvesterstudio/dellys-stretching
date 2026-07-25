import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LOCATION_COOKIE, type Location } from "@/lib/locations";

// Active gyms, in display order. Returns [] when Supabase isn't configured so
// callers degrade to an empty schedule instead of throwing.
export async function fetchLocations(): Promise<Location[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("locations")
      .select("id, key, name, address_ro, address_ru, phone, maps_url, sort_order")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("fetchLocations:", error.message);
      return [];
    }
    return (data ?? []) as Location[];
  } catch {
    return [];
  }
}

// The gym a public page should show: an explicit ?loc=key wins, then the
// remembered cookie, then the first gym. Falls back safely on any bad input.
export async function resolveLocation(
  locations: Location[],
  requestedKey?: string | null,
): Promise<Location | null> {
  if (locations.length === 0) return null;
  if (requestedKey) {
    const hit = locations.find((l) => l.key === requestedKey);
    if (hit) return hit;
  }
  try {
    const store = await cookies();
    const saved = store.get(LOCATION_COOKIE)?.value;
    if (saved) {
      const hit = locations.find((l) => l.key === saved);
      if (hit) return hit;
    }
  } catch {
    // cookies() is unavailable in some rendering contexts — fall through.
  }
  return locations[0];
}

// Resolve the gym an admin screen should currently display. A location-scoped
// admin is pinned to their own gym and cannot look at the other one; an
// unrestricted admin follows the switcher (cookie / ?loc=).
export async function resolveAdminLocation(
  profile: { location_id: string | null },
  locations: Location[],
  requestedKey?: string | null,
): Promise<Location | null> {
  if (profile.location_id) {
    return locations.find((l) => l.id === profile.location_id) ?? null;
  }
  return resolveLocation(locations, requestedKey);
}

export interface AdminScope {
  locations: Location[];
  active: Location | null;
  activeId: string | null;
  // A pinned manager sees one gym and gets no switcher; a super-admin may roam.
  canSwitch: boolean;
}

// Everything an admin screen needs to scope itself to one studio. Pass the
// profile you already resolved with requireAdmin()/requireStaff().
export async function getAdminScope(
  profile: { location_id: string | null },
  requestedKey?: string | null,
): Promise<AdminScope> {
  const locations = await fetchLocations();
  const active = await resolveAdminLocation(profile, locations, requestedKey);
  return {
    locations,
    active,
    activeId: active?.id ?? null,
    canSwitch: profile.location_id === null && locations.length > 1,
  };
}
