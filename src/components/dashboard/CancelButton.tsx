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
  withinWindow: boolean; // true => less than the free-cancel window remains
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
      <button
        onClick={cancel}
        disabled={busy}
        className="text-xs text-mauve-500 underline hover:text-red-600"
      >
        {busy ? dict.common.loading : dict.dashboard.cancelBooking}
      </button>
      {withinWindow && (
        <div className="mt-0.5 text-[11px] text-amber-600">
          {dict.dashboard.cancelTooLate}
        </div>
      )}
      {error && <div className="mt-0.5 text-[11px] text-red-600">{error}</div>}
    </div>
  );
}
