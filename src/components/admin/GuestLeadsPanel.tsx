"use client";

import { useState, useTransition } from "react";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDate, formatTime } from "@/lib/format";
import {
  setGuestBookingStatusAction,
  convertGuestToAccountAction,
} from "@/app/[lang]/admin/actions";

export interface GuestLead {
  id: string;
  full_name: string;
  child_name: string | null;
  phone: string;
  class_name: string | null;
  starts_at: string | null;
  status: "new" | "contacted" | "confirmed" | "cancelled";
  claimed_by: string | null;
  created_at: string;
}

// Renders the guest-reservation rows. Reused two ways:
//  - `bare`: just the rows (no heading/empty state) — merged into a session's
//    participant list on the roster page.
//  - default: a full section with heading + count — the Today page.
// `showClassTime` adds the class + date to each row (useful on Today where leads
// span many classes; redundant on a single session's roster).
export function GuestLeadsPanel({
  leads,
  lang,
  dict,
  bare = false,
  showClassTime = true,
}: {
  leads: GuestLead[];
  lang: Locale;
  dict: Dictionary;
  bare?: boolean;
  showClassTime?: boolean;
}) {
  const t = dict.admin.guestLeads;

  const rows = (
    <div className="space-y-2">
      {leads.map((l) => (
        <LeadRow key={l.id} lead={l} lang={lang} dict={dict} showClassTime={showClassTime} />
      ))}
    </div>
  );

  if (bare) return leads.length > 0 ? rows : null;

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-lg font-semibold text-mauve-800">{t.title}</h2>
        {leads.length > 0 && <span className="badge-brand">{leads.length}</span>}
      </div>
      {leads.length === 0 ? (
        <div className="card p-5 text-sm text-mauve-500">{t.none}</div>
      ) : (
        rows
      )}
    </section>
  );
}

function LeadRow({
  lead: l,
  lang,
  dict,
  showClassTime,
}: {
  lead: GuestLead;
  lang: Locale;
  dict: Dictionary;
  showClassTime: boolean;
}) {
  const t = dict.admin.guestLeads;
  const [pending, startTransition] = useTransition();
  const [converting, setConverting] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState(false);
  // Optimistic: once converted, flip locally so the row updates instantly.
  const [claimed, setClaimed] = useState(!!l.claimed_by);

  function move(status: GuestLead["status"]) {
    startTransition(async () => {
      await setGuestBookingStatusAction(l.id, status);
    });
  }

  function convert() {
    setError(false);
    startTransition(async () => {
      const res = await convertGuestToAccountAction(l.id, email);
      if (res.error) {
        setError(true);
        return;
      }
      setClaimed(true);
      setConverting(false);
    });
  }

  return (
    <div
      className={`card p-4 ${l.status === "cancelled" ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-mauve-900">{l.child_name || l.full_name}</span>
            <span className="badge-success">{t.booked}</span>
            {claimed && <span className="badge-brand">{t.hasAccount}</span>}
          </div>
          <div className="mt-0.5 text-sm text-mauve-500">
            {l.child_name && <>{t.parent}: {l.full_name} · </>}
            <a href={`tel:${l.phone.replace(/\s/g, "")}`} className="text-brand-600 hover:underline">
              {l.phone}
            </a>
            {showClassTime && l.class_name && <> · {l.class_name}</>}
            {showClassTime && l.starts_at && (
              <> · {formatDate(l.starts_at, lang)} {formatTime(l.starts_at, lang)}</>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {!claimed && l.status !== "cancelled" && !converting && (
            <button
              onClick={() => setConverting(true)}
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              {t.createAccount}
            </button>
          )}
          {l.status !== "cancelled" && (
            <button
              disabled={pending}
              onClick={() => move("cancelled")}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-mauve-400 hover:text-mauve-700"
            >
              {t.dismiss}
            </button>
          )}
        </div>
      </div>

      {/* Convert to a real account by capturing an email at check-in. */}
      {converting && !claimed && (
        <div className="mt-3 border-t border-mauve-100 pt-3">
          <label className="label">{t.emailLabel}</label>
          <div className="flex gap-2">
            <input
              type="email"
              inputMode="email"
              autoComplete="off"
              className="input"
              placeholder={t.emailPlaceholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              disabled={pending || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}
              onClick={convert}
              className="btn-primary whitespace-nowrap px-4 text-sm"
            >
              {pending ? dict.common.loading : t.createAccount}
            </button>
          </div>
          {error && <p className="mt-1.5 text-xs text-red-500">{dict.common.error}</p>}
        </div>
      )}
    </div>
  );
}
