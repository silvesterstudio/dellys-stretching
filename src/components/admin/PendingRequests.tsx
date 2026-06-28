"use client";

import { useState } from "react";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/i18n-data";
import { formatPrice, formatDate } from "@/lib/format";
import { decideMembershipRequestAction } from "@/app/[lang]/admin/actions";

export type RequestRow = {
  id: string;
  created_at: string;
  member: string; // display name / email
  plan_name_ro: string;
  plan_name_ru: string;
  session_count: number;
  price: number;
  currency: string;
};

export function PendingRequests({
  lang,
  dict,
  initial,
}: {
  lang: Locale;
  dict: Dictionary;
  initial: RequestRow[];
}) {
  const [rows, setRows] = useState<RequestRow[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    const { error } = await decideMembershipRequestAction(id, approve);
    setBusyId(null);
    if (error) {
      setError(dict.common.error);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-mauve-800">
        {dict.admin.pendingRequests}
        {rows.length > 0 && (
          <span className="badge bg-brand-600 text-white">{rows.length}</span>
        )}
      </h2>

      {error && (
        <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {rows.length === 0 ? (
        <p className="card p-4 text-sm text-mauve-400">{dict.admin.noRequests}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const planName = localized(
              { name_ro: r.plan_name_ro, name_ru: r.plan_name_ru },
              "name",
              lang,
            );
            return (
              <div
                key={r.id}
                className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="font-medium text-mauve-900">{r.member}</div>
                  <div className="text-sm text-mauve-600">
                    {planName} · {r.session_count} {dict.memberships.sessions} ·{" "}
                    <span className="font-semibold text-brand-600">
                      {formatPrice(r.price, r.currency, lang)}
                    </span>
                  </div>
                  <div className="text-xs text-mauve-400">
                    {dict.admin.requestedOn} {formatDate(r.created_at, lang)}
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => decide(r.id, true)}
                    disabled={busyId === r.id}
                    className="btn-primary px-4 py-2 text-sm"
                  >
                    ✓ {dict.admin.approve}
                  </button>
                  <button
                    onClick={() => decide(r.id, false)}
                    disabled={busyId === r.id}
                    className="btn-secondary px-4 py-2 text-sm"
                  >
                    {dict.admin.reject}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
