import { TIMEZONE, type Locale } from "@/lib/constants";

const localeTag: Record<Locale, string> = { ro: "ro-RO", ru: "ru-RU" };

// All formatting pins the timezone to Europe/Bucharest so display is correct
// regardless of where the server or the user's browser runs (avoids DST bugs).

export function formatTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}

export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}

export function formatDateShort(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(localeTag[locale], {
    day: "2-digit",
    month: "2-digit",
    timeZone: TIMEZONE,
  }).format(new Date(iso));
}

export function formatPrice(amount: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(localeTag[locale], {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// The weekday index (0=Sun..6=Sat) of an instant, evaluated in the gym timezone.
export function weekdayInTz(iso: string): number {
  const wd = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: TIMEZONE,
  }).format(new Date(iso));
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(wd);
}

// Wall-clock "HH:MM" (24h) of an instant in the gym timezone — for deriving a
// recurring template's start_time from a concrete session.
export function wallTimeInTz(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
