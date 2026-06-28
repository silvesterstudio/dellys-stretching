"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Dictionary } from "@/i18n/get-dictionary";
import { checkInAction, markNoShowAction } from "@/app/[lang]/admin/actions";
import { checkInErrorMessage } from "@/lib/booking-errors";

interface Booking {
  id: string;
  status: string;
  name: string;
  child_name: string | null;
}
interface MembershipOpt {
  id: string;
  label: string;
}

export function CheckInRow({
  dict,
  booking,
  memberships,
  freeTrialAvailable = false,
}: {
  dict: Dictionary;
  booking: Booking;
  memberships: MembershipOpt[];
  freeTrialAvailable?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [membershipId, setMembershipId] = useState<string>(
    memberships[0]?.id ?? "",
  );

  const settled =
    booking.status === "attended" ||
    booking.status === "no_show" ||
    booking.status === "cancelled";

  async function checkIn() {
    setBusy(true);
    setError(null);
    const { error } = await checkInAction(booking.id, membershipId || null);
    setBusy(false);
    if (error) {
      setError(checkInErrorMessage(error, dict));
      return;
    }
    router.refresh();
  }

  async function noShow() {
    setBusy(true);
    setError(null);
    const { error } = await markNoShowAction(booking.id);
    setBusy(false);
    if (error) {
      setError(dict.common.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-mauve-900">
            {booking.name}
            {booking.child_name && (
              <span className="ml-2 text-xs text-mauve-400">· {booking.child_name}</span>
            )}
          </div>
          <StatusBadge status={booking.status} dict={dict} />
        </div>

        {!settled && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="input max-w-52 py-1.5 text-sm"
              value={membershipId}
              onChange={(e) => setMembershipId(e.target.value)}
            >
              <option value="">{dict.admin.noMembershipDeduct}</option>
              {memberships.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
            <button onClick={checkIn} disabled={busy} className="btn-primary py-1.5 text-sm">
              {dict.admin.markAttended}
            </button>
            <button onClick={noShow} disabled={busy} className="btn-secondary py-1.5 text-sm">
              {dict.admin.markNoShow}
            </button>
            {/* When no membership is being deducted, tell the admin whether this
                is the client's one free trial or a pay-at-reception session. */}
            {membershipId === "" &&
              (freeTrialAvailable ? (
                <span className="badge-success">{dict.admin.freeTrial}</span>
              ) : (
                <span className="badge-warning">{dict.admin.payReception}</span>
              ))}
          </div>
        )}
      </div>
      {error && <div className="mt-1 text-xs text-red-700">{error}</div>}
    </div>
  );
}

function StatusBadge({ status, dict }: { status: string; dict: Dictionary }) {
  const map: Record<string, { cls: string; label: string }> = {
    booked: { cls: "badge-brand", label: dict.common.booked },
    pending: { cls: "badge-warning", label: dict.common.booked },
    attended: { cls: "badge-success", label: dict.admin.attended },
    no_show: { cls: "badge-muted", label: dict.admin.noShow },
    cancelled: { cls: "badge-muted", label: dict.common.cancel },
  };
  const m = map[status] ?? map.booked;
  return <span className={`${m.cls} mt-1`}>{m.label}</span>;
}
