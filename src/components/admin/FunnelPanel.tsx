import type { Dictionary } from "@/i18n/get-dictionary";
import type { GuestFunnel } from "@/lib/admin-analytics";

// Acquisition funnel: unique guest bookings → accounts created from them →
// memberships bought by those accounts, with step-to-step conversion rates.
export function FunnelPanel({ funnel, dict }: { funnel: GuestFunnel; dict: Dictionary }) {
  const t = dict.admin.funnel;
  const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

  const steps = [
    { label: t.guests, value: funnel.guests, conv: null as number | null },
    { label: t.accounts, value: funnel.accounts, conv: pct(funnel.accounts, funnel.guests) },
    { label: t.memberships, value: funnel.memberships, conv: pct(funnel.memberships, funnel.accounts) },
  ];
  const max = Math.max(funnel.guests, 1);

  return (
    <section className="card p-5">
      <h2 className="text-lg font-semibold text-mauve-800">{t.title}</h2>
      <p className="mt-0.5 text-sm text-mauve-500">{t.subtitle}</p>

      <div className="mt-4 space-y-3">
        {steps.map((s) => (
          <div key={s.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-mauve-700">{s.label}</span>
              <span className="flex items-baseline gap-2">
                <span className="font-display text-xl font-semibold text-mauve-900">{s.value}</span>
                {s.conv !== null && (
                  <span className="text-xs font-medium text-brand-600">{s.conv}%</span>
                )}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-mauve-100">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(2, Math.round((s.value / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
