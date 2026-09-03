// App-wide constants. Keep business rules here so they're easy to audit/tune.

// The studio is in Moldova (prices in MDL). Chișinău shares Bucharest's UTC
// offset and DST rules, so display is unchanged — this is the semantically
// correct zone and future-proofs against any divergence in DST policy.
export const TIMEZONE = "Europe/Chisinau";

// Public origin of the site, used for SEO absolutes (canonical URLs, Open Graph,
// sitemap, JSON-LD). Set NEXT_PUBLIC_SITE_URL in production; the fallback keeps
// local/dev builds working. No trailing slash.
//
// A *.vercel.app value is ignored on purpose. Every deployment gets one, and if
// it leaks in here the whole site tells Google its canonical home is the
// deploy URL rather than dellys.md — which is how a site disappears from its
// own search results. The custom domain is the only correct answer in
// production, so hard-code it as the fallback for that case too.
const CANONICAL_ORIGIN = "https://dellys.md";
const configuredOrigin = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
// Matched on the string, not via new URL(): this runs at module load, and a
// malformed env var must not crash every page on the site.
export const SITE_URL =
  configuredOrigin && !/^https?:\/\/[^/]*\.vercel\.app$/i.test(configuredOrigin)
    ? configuredOrigin
    : CANONICAL_ORIGIN;

export const LOCALES = ["ro", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ro";

// The two edges of online self-service, in hours before the class starts.
//
// A class only runs with enough people in it, and that call is made a few hours
// ahead — so a booking that lands minutes before the hour is worth nothing to
// it, and a late cancellation can empty a class with nobody left to tell.
//
// THE DATABASE IS THE AUTHORITY (book_session / cancel_booking — 0037, and
// 0038 for the booking figure).
// These two constants only let the UI close its buttons at the same moment and
// say so beforehand; changing them here changes nothing that anybody can
// bypass. Change the migration in the same breath.
export const BOOKING_CUTOFF_HOURS = 2;
export const CANCEL_CUTOFF_HOURS = 5;

// Default class capacity when a class type / template doesn't override it.
export const DEFAULT_CAPACITY = 11;

// A user without a valid (non-expired, sessions-remaining) membership may hold at
// most this many active future bookings. Guards against "book-freely" abuse.
export const MAX_OPEN_BOOKINGS_NO_MEMBERSHIP = 3;

// How long a pending (seat-held, code-requested-but-not-verified) reservation
// lives before the cleanup job releases the seat.
export const PENDING_RESERVATION_MINUTES = 10;

// How many weeks ahead the generator keeps sessions materialized from templates.
export const SESSION_GENERATION_WEEKS = 4;

export const CLASS_AUDIENCES = ["adult", "child"] as const;
export type ClassAudience = (typeof CLASS_AUDIENCES)[number];

// Free-trial categories: every client gets ONE free introductory session per
// category (mirrors class_types.category). Order = display order on the account.
export const TRIAL_CATEGORIES = ["adult", "kids_3_7", "kids_8_13"] as const;
export type TrialCategory = (typeof TRIAL_CATEGORIES)[number];

export const BOOKING_STATUSES = [
  "pending",
  "booked",
  "attended",
  "no_show",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
