"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function CancelRequestButton({
  requestId,
  label,
}: {
  requestId: string;
  label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    const supabase = createClient();
    await supabase.rpc("cancel_membership_request", { p_request_id: requestId });
    setBusy(false);
    router.refresh();
  }

  return (
    <button
      onClick={cancel}
      disabled={busy}
      className="shrink-0 text-xs text-mauve-500 underline hover:text-red-600"
    >
      {label}
    </button>
  );
}
