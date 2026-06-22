// App-wide constants. Keep business rules here so they're easy to audit/tune.

// The studio is in Moldova (prices in MDL). Chișinău shares Bucharest's UTC
// offset and DST rules, so display is unchanged — this is the semantically
// correct zone and future-proofs against any divergence in DST policy.
export const TIMEZONE = "Europe/Chisinau";

export const LOCALES = ["ro", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "ro";

// Free-cancellation window: a user may cancel a booking up to this many hours
// before the session starts. After this, cancelling counts against them and the
// seat policy is enforced by the admin.
export const CANCEL_WINDOW_HOURS = 12;

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

export const BOOKING_STATUSES = [
  "pending",
  "booked",
  "attended",
  "no_show",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
