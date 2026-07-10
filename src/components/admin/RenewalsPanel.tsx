import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { RenewalRow } from "@/lib/admin-analytics";
import { formatDate } from "@/lib/format";

// Dashboard panel: members to nudge (membership expiring soon or low on sessions).
export function RenewalsPanel({
  rows,
  lang,
  dict,
}: {
  rows: RenewalRow[];
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.admin.renewals;
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-mauve-900">
        {t.title}
        {rows.length > 0 && (
          <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            {rows.length}
          </span>
        )}
      </h2>
      {rows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-mauve-400">{t.none}</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div
              key={r.userId}
              className="card flex flex-wrap items-center justify-between gap-3 p-3.5"
            >
              <div className="min-w-0">
                <div className="truncate font-medium text-mauve-900">{r.name}</div>
                {r.phone && <div className="truncate text-xs text-mauve-400">{r.phone}</div>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {r.lowBalance && (
                  <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                    {r.sessionsRemaining} {t.sessionsLeft}
                  </span>
                )}
                {r.expiringSoon && (
                  <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                    {t.expires} {formatDate(r.expiresAt, lang)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
