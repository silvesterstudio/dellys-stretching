import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireAdmin } from "@/lib/auth";
import {
  resolveRange,
  computeKpis,
  computeWindowMetrics,
  computeActivitySeries,
  computeRenewals,
  computeRecentTransactions,
  computeRecentAudit,
  computeGuestFunnel,
  type RangePreset,
} from "@/lib/admin-analytics";
import { AnalyticsDashboard } from "@/components/admin/AnalyticsDashboard";
import { FunnelPanel } from "@/components/admin/FunnelPanel";
import { RenewalsPanel } from "@/components/admin/RenewalsPanel";
import { TransactionsPanel } from "@/components/admin/TransactionsPanel";
import { AuditPanel } from "@/components/admin/AuditPanel";
import { ResetPanel } from "@/components/admin/ResetPanel";
import { LocationBar } from "@/components/admin/LocationBar";
import { getAdminScope } from "@/lib/locations-server";

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
  let me;
  try {
    me = await requireAdmin();
  } catch {
    redirect("/staff");
  }
  // Restricted admins (dashboard_access=false, e.g. the dellys_admin operator
  // account) can manage everything except the financial dashboard.
  if (!me.dashboard_access) {
    redirect("/admin/today");
  }

  // Every figure below is scoped to one studio, so a gym's manager sees their
  // own revenue and attendance rather than the whole business.
  const scope = await getAdminScope(me);
  const loc = scope.activeId;

  const initialPreset: RangePreset = "7d";
  const { startISO, endISO, startDate, endDate } = resolveRange({ preset: initialPreset });
  const [kpis, metrics, series, renewals, transactions, audit, funnel] = await Promise.all([
    computeKpis(new Date(), loc),
    computeWindowMetrics(startISO, endISO, loc),
    computeActivitySeries(startISO, endISO, loc),
    computeRenewals(new Date(), 7, 2, loc),
    computeRecentTransactions(locale, 20, loc),
    computeRecentAudit(),
    computeGuestFunnel(),
  ]);

  return (
    <div className="space-y-8">
      <LocationBar
        locations={scope.locations}
        activeId={scope.activeId}
        canSwitch={scope.canSwitch}
        lang={locale}
        dict={dict}
      />
      <AnalyticsDashboard
        lang={locale}
        dict={dict}
        kpis={kpis}
        initialMetrics={metrics}
        initialSeries={series}
        initialPreset={initialPreset}
        initialStart={startDate}
        initialEnd={endDate}
      />
      <RenewalsPanel rows={renewals} lang={locale} dict={dict} />
      <TransactionsPanel rows={transactions} lang={locale} dict={dict} />
      {/* The guest funnel and the audit log span the whole business and carry
          no location of their own, so they stay with unrestricted admins. */}
      {me.location_id === null && (
        <>
          <FunnelPanel funnel={funnel} dict={dict} />
          <AuditPanel rows={audit} lang={locale} dict={dict} />
          <ResetPanel kind="stats" dict={dict} />
        </>
      )}
    </div>
  );
}
