import type { Dictionary } from "@/i18n/get-dictionary";

// Maps a coded exception from the book_session RPC to a localized, user-facing
// message. Unknown codes fall back to a generic error.
export function bookingErrorMessage(raw: string, dict: Dictionary): string {
  const code = raw.toUpperCase();
  const b = dict.booking;
  if (code.includes("SESSION_FULL")) return b.sessionFull;
  if (code.includes("ALREADY_BOOKED")) return b.alreadyBooked;
  if (code.includes("PAST_SESSION")) return b.pastSession;
  if (code.includes("SESSION_CANCELLED")) return b.pastSession;
  if (code.includes("TOO_MANY_OPEN")) return b.tooManyOpen;
  if (code.includes("CHILD_REQUIRED")) return b.selectChild;
  if (code.includes("INVALID_CHILD")) return b.selectChild;
  return dict.common.error;
}

// A booking failure the user cannot recover from on the confirm screen (the
// session is full/cancelled/gone, or they're already booked). The form should
// offer navigation instead of a "try again" inline error.
export function isTerminalBookingError(raw: string): boolean {
  const code = raw.toUpperCase();
  return (
    code.includes("SESSION_FULL") ||
    code.includes("SESSION_CANCELLED") ||
    code.includes("PAST_SESSION") ||
    code.includes("SESSION_NOT_FOUND") ||
    code.includes("ALREADY_BOOKED")
  );
}

export function isAlreadyBooked(raw: string): boolean {
  return raw.toUpperCase().includes("ALREADY_BOOKED");
}

// cancel_booking RPC error -> localized message (distinct codes, not generic).
export function cancelBookingErrorMessage(raw: string, dict: Dictionary): string {
  const code = raw.toUpperCase();
  if (code.includes("PAST_SESSION")) return dict.booking.pastSession;
  if (code.includes("NOT_CANCELLABLE")) return dict.dashboard.cancelNotAllowed;
  return dict.common.error;
}

// check_in_booking RPC error -> localized message for the admin roster screen.
// The roster pre-filters the membership dropdown to usable memberships, so these
// mostly cover the stale/race window (e.g. a membership emptied between page
// load and the click) — but without this the admin saw a raw Postgres string.
export function checkInErrorMessage(raw: string, dict: Dictionary): string {
  const code = raw.toUpperCase();
  const e = dict.admin.checkInError;
  if (code.includes("MEMBERSHIP_FROZEN")) return e.frozen;
  if (code.includes("MEMBERSHIP_EXPIRED")) return e.expired;
  if (code.includes("MEMBERSHIP_EMPTY")) return e.empty;
  if (code.includes("MEMBERSHIP_WRONG_AUDIENCE")) return e.wrongAudience;
  if (code.includes("MEMBERSHIP_WRONG_USER")) return e.wrongUser;
  if (code.includes("MEMBERSHIP_NOT_FOUND")) return e.notFound;
  if (code.includes("NOT_CHECKINABLE")) return e.notCheckinable;
  return dict.common.error;
}

// cancel_membership_request RPC error -> localized message.
export function cancelRequestErrorMessage(raw: string, dict: Dictionary): string {
  const code = raw.toUpperCase();
  if (code.includes("NOT_PENDING")) return dict.dashboard.requestNotPending;
  return dict.common.error;
}
