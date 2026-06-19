import type { Dictionary } from "@/i18n/get-dictionary";

// Maps a coded exception from the book_session / cancel RPCs to a localized,
// user-facing message. Unknown codes fall back to a generic error.
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
