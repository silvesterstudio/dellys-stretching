"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import { cancelBookingErrorMessage } from "@/lib/booking-errors";

export function CancelButton({
  bookingId,
  dict,
  withinWindow,
}: {
  bookingId: string;
  dict: Dictionary;
  withinWindow: boolean; // true => inside the 5h window, cancelling is closed
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_booking", {
      p_booking_id: bookingId,
    });
    setBusy(false);
    if (error) {
      setError(cancelBookingErrorMessage(error.message, dict));
      return;
    }
    router.refresh();
  }

  return (
    <div className="text-right">
      {/* Inside the window the button is dead rather than absent: a control
          that vanishes reads as a bug, one that explains itself reads as a
          rule. The database refuses it either way (CANCEL_CLOSED). */}
      <button
        onClick={cancel}
        disabled={busy || withinWindow}
        className="btn-ghost-danger px-3 py-1.5 text-sm"
      >
        {busy ? dict.common.loading : dict.dashboard.cancelBooking}
      </button>
      {withinWindow && (
        <div className="mt-0.5 text-xs text-amber-700">
          {dict.dashboard.cancelTooLate}
        </div>
      )}
      {error && <div className="mt-0.5 text-xs text-red-700">{error}</div>}
    </div>
  );
}
