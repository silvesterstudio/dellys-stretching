"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { LOCATION_COOKIE, localizedAddress, type Location } from "@/lib/locations";

// Shows which studio the admin screens are currently scoped to. A manager
// pinned to one gym sees a plain label (there is nothing to switch to); an
// unrestricted admin gets buttons.
//
// Switching writes the cookie the server reads in resolveAdminLocation, then
// refreshes — so every admin page re-renders scoped to the new gym without each
// one having to thread a ?loc= param through its own links.
export function LocationBar({
  locations,
  activeId,
  canSwitch,
  lang,
  dict,
}: {
  locations: Location[];
  activeId: string | null;
  canSwitch: boolean;
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const active = locations.find((l) => l.id === activeId) ?? null;

  if (locations.length === 0) return null;

  if (!canSwitch) {
    if (!active) return null;
    return (
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-mauve-400">
          {dict.schedule.locationLabel}
        </span>
        <span className="font-display text-base font-bold text-mauve-900">{active.name}</span>
        <span className="text-xs text-mauve-400">{localizedAddress(active, lang)}</span>
      </div>
    );
  }

  function choose(loc: Location) {
    if (loc.id === activeId) return;
    document.cookie = `${LOCATION_COOKIE}=${encodeURIComponent(loc.key)}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    start(() => router.refresh());
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-mauve-400">
        {dict.schedule.locationLabel}
      </span>
      <div
        role="group"
        aria-label={dict.schedule.locationLabel}
        className="inline-flex flex-wrap gap-1 rounded-full border border-mauve-100 bg-white p-1"
      >
        {locations.map((l) => {
          const on = l.id === activeId;
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={on}
              disabled={pending}
              onClick={() => choose(l)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
                on
                  ? "bg-mauve-900 text-white"
                  : "text-mauve-600 hover:bg-mauve-50 disabled:opacity-50"
              }`}
            >
              {l.name}
            </button>
          );
        })}
      </div>
      {active && (
        <span className="text-xs text-mauve-400">{localizedAddress(active, lang)}</span>
      )}
    </div>
  );
}
