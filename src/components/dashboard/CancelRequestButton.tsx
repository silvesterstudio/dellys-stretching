"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Dictionary } from "@/i18n/get-dictionary";
import { cancelRequestErrorMessage } from "@/lib/booking-errors";

export function CancelRequestButton({
  requestId,
  label,
  dict,
}: {
  requestId: string;
  label: string;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.rpc("cancel_membership_request", {
      p_request_id: requestId,
    });
    setBusy(false);
    if (error) {
      setError(cancelRequestErrorMessage(error.message, dict));
      return;
    }
    router.refresh();
  }

  return (
    <div className="shrink-0 text-right">
      <button
        onClick={cancel}
        disabled={busy}
        className="text-xs text-mauve-500 underline hover:text-red-600"
      >
        {label}
      </button>
      {error && <div className="mt-0.5 text-[11px] text-red-600">{error}</div>}
    </div>
  );
}
