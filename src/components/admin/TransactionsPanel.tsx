import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { TransactionRow } from "@/lib/admin-analytics";
import { formatDate, formatPrice } from "@/lib/format";

// Dashboard panel: recent membership sales that recorded a payment.
export function TransactionsPanel({
  rows,
  lang,
  dict,
}: {
  rows: TransactionRow[];
  lang: Locale;
  dict: Dictionary;
}) {
  const t = dict.admin.transactions;
  const methodLabel: Record<string, string> = {
    cash: t.cash,
    card: t.card,
    transfer: t.transfer,
    free: t.free,
  };
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
                <div className="truncate text-sm font-medium text-mauve-900">{r.member}</div>
                <div className="truncate text-xs text-mauve-400">
                  {r.plan} · {formatDate(r.date, lang)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-brand-600">
                  {formatPrice(r.amount, r.currency, lang)}
                </div>
                {r.method && (
                  <div className="text-[11px] text-mauve-400">
                    {methodLabel[r.method] ?? r.method}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
