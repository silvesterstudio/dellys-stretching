import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { AuditRow } from "@/lib/admin-analytics";
import { formatDate, formatTime } from "@/lib/format";

// Dashboard panel: recent admin/staff actions (the audit log).
export function AuditPanel({
  rows,
  lang,
  dict,
}: {
  rows: AuditRow[];
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.admin.audit;
  const label = (action: string) => t.actions[action as keyof typeof t.actions] ?? action;

  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-semibold text-mauve-900">{t.title}</h2>
      {rows.length === 0 ? (
        <div className="card p-6 text-center text-sm text-mauve-400">{t.none}</div>
      ) : (
        <div className="card divide-y divide-mauve-100">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-mauve-800">{label(r.action)}</div>
                <div className="truncate text-xs text-mauve-400">{r.actor}</div>
              </div>
              <div className="shrink-0 text-right text-xs text-mauve-400">
                {formatDate(r.date, lang)} · {formatTime(r.date, lang)}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
