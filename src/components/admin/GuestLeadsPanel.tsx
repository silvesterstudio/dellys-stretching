"use client";

import { useState, useTransition } from "react";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDate, formatTime } from "@/lib/format";
import { setGuestBookingStatusAction } from "@/app/[lang]/admin/actions";

export interface GuestLead {
  id: string;
  full_name: string;
  phone: string;
  class_name: string | null;
  starts_at: string | null;
  status: "new" | "contacted" | "confirmed" | "cancelled";
  created_at: string;
}

const BADGE: Record<GuestLead["status"], string> = {
  new: "badge-brand",
  contacted: "badge-muted",
  confirmed: "badge-success",
  cancelled: "badge-muted",
};

export function GuestLeadsPanel({
  leads,
  lang,
  dict,
}: {
  leads: GuestLead[];
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.admin.guestLeads;
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  function move(id: string, status: GuestLead["status"]) {
    setBusyId(id);
    startTransition(async () => {
      await setGuestBookingStatusAction(id, status);
      setBusyId(null);
    });
  }

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-mauve-800">{t.title}</h2>
        {leads.length > 0 && (
          <span className="badge-brand">{leads.filter((l) => l.status === "new").length}</span>
        )}
      </div>

      {leads.length === 0 ? (
        <div className="card p-5 text-sm text-mauve-500">{t.none}</div>
      ) : (
        <div className="space-y-2">
          {leads.map((l) => {
            const busy = pending && busyId === l.id;
            return (
              <div
                key={l.id}
                className={`card flex flex-wrap items-center justify-between gap-3 p-4 ${
                  l.status === "cancelled" ? "opacity-60" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-mauve-900">{l.full_name}</span>
                    <span className={BADGE[l.status]}>{t.status[l.status]}</span>
                  </div>
                  <div className="mt-0.5 text-sm text-mauve-500">
                    <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="text-brand-600 hover:underline">
                      {l.phone}
                    </a>
                    {l.class_name && <> · {l.class_name}</>}
                    {l.starts_at && (
                      <> · {formatDate(l.starts_at, lang)} {formatTime(l.starts_at, lang)}</>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 gap-2">
                  {l.status === "new" && (
                    <button
                      disabled={busy}
                      onClick={() => move(l.id, "contacted")}
                      className="btn-secondary px-3 py-1.5 text-xs"
                    >
                      {t.markContacted}
                    </button>
                  )}
                  {(l.status === "new" || l.status === "contacted") && (
                    <>
                      <button
                        disabled={busy}
                        onClick={() => move(l.id, "confirmed")}
                        className="btn-primary px-3 py-1.5 text-xs"
                      >
                        {t.markConfirmed}
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => move(l.id, "cancelled")}
                        className="rounded-full px-3 py-1.5 text-xs font-medium text-mauve-400 hover:text-mauve-700"
                      >
                        {t.dismiss}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
