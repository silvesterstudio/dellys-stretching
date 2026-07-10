import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireAdmin } from "@/lib/auth";
import {
  resolveRange,
  computeKpis,
  computeWindowMetrics,
  computeRenewals,
  computeRecentTransactions,
  computeRecentAudit,
  type RangePreset,
} from "@/lib/admin-analytics";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { RenewalsPanel } from "@/components/admin/RenewalsPanel";
import { TransactionsPanel } from "@/components/admin/TransactionsPanel";
import { AuditPanel } from "@/components/admin/AuditPanel";
import { ResetPanel } from "@/components/admin/ResetPanel";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  // The admin layout already gates this, but re-verify before touching the
  // service-role analytics queries (defense in depth around RLS-bypassing reads).
  // Mirror the layout: a non-admin gets redirected, not an error.
  try {
    await requireAdmin();
  } catch {
    redirect(`/${locale}/staff`);
  }

  const initialPreset: RangePreset = "7d";
  const { startISO, endISO, startDate, endDate } = resolveRange({ preset: initialPreset });
  const [kpis, metrics, renewals, transactions, audit] = await Promise.all([
    computeKpis(),
    computeWindowMetrics(startISO, endISO),
    computeRenewals(),
    computeRecentTransactions(locale),
    computeRecentAudit(),
  ]);

  return (
    <div className="space-y-8">
      <AnalyticsDashboard
        lang={locale}
        dict={dict}
        kpis={kpis}
        initialMetrics={metrics}
        initialPreset={initialPreset}
        initialStart={startDate}
        initialEnd={endDate}
      />
      <RenewalsPanel rows={renewals} lang={locale} dict={dict} />
      <TransactionsPanel rows={transactions} lang={locale} dict={dict} />
      <AuditPanel rows={audit} lang={locale} dict={dict} />
      <ResetPanel kind="stats" dict={dict} />
    </div>
  );
}
