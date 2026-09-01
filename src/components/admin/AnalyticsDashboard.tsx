"use client";

import { useState, useTransition } from "react";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatPrice } from "@/lib/format";
import type {
  RangePreset,
  WindowMetrics,
  KpiMetrics,
  ActivitySeries,
} from "@/lib/admin-analytics";
import { BarChartCard } from "@/components/admin/BarChartCard";
import { getMetricsAction } from "@/app/[lang]/admin/dashboard/actions";

// The picker, nearest window first, the way the reference orders it.
const PRESETS: { key: RangePreset; labelKey: keyof Dictionary["admin"]["stats"] }[] = [
  { key: "yesterday", labelKey: "yesterday" },
  { key: "today", labelKey: "today" },
  { key: "7d", labelKey: "last7" },
  { key: "30d", labelKey: "last30" },
  { key: "365d", labelKey: "last365" },
];

interface Tile {
  label: string;
  hint: string;
  value: string | number;
  dot: string;
  accent?: boolean;
}

function StatTile({ c }: { c: Tile }) {
  return (
    <div className="panel p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} aria-hidden />
        <span className="truncate text-sm font-semibold text-mauve-700">{c.label}</span>
      </div>
      <div className={`stat-value mt-2 ${c.accent ? "text-brand-600" : ""}`}>{c.value}</div>
      <div className="mt-1.5 text-xs leading-snug text-mauve-400">{c.hint}</div>
    </div>
  );
}

export function AnalyticsDashboard({
  lang,
  dict,
  kpis,
  initialMetrics,
  initialSeries,
  initialPreset,
  initialStart,
  initialEnd,
}: {
  lang: Locale;
  dict: Dictionary;
  kpis: KpiMetrics;
  initialMetrics: WindowMetrics;
  initialSeries: ActivitySeries;
  initialPreset: RangePreset;
  initialStart: string;
  initialEnd: string;
}) {
  const t = dict.admin.stats;
  const [preset, setPreset] = useState<RangePreset>(initialPreset);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [series, setSeries] = useState(initialSeries);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [showDates, setShowDates] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(p: RangePreset) {
    setPreset(p);
    setShowDates(false);
    startTransition(async () => {
      const res = await getMetricsAction({ preset: p });
      setMetrics(res.metrics);
      setSeries(res.series);
      setStartDate(res.startDate);
      setEndDate(res.endDate);
    });
  }

  function applyCustom() {
    setPreset("custom");
    startTransition(async () => {
      const res = await getMetricsAction({ preset: "custom", startDate, endDate });
      setMetrics(res.metrics);
      setSeries(res.series);
      setStartDate(res.startDate);
      setEndDate(res.endDate);
    });
  }

  // The six headline figures.
  //
  // The reference's six include "Referrals" and "Trainer Sessions". Dellys has
  // neither — no referral scheme, no personal-training entity, nothing in the
  // schema to count — so rather than print two permanent zeros dressed up as
  // metrics, those two slots carry figures that are real: new members, and
  // classes actually held.
  //
  // The first tile is a SNAPSHOT and does not move with the picker, unlike the
  // other five. It says so beneath the number: a live figure sitting in a row of
  // windowed ones is exactly the confusion this screen used to have.
  const headline: Tile[] = [
    {
      label: t.activeMemberships,
      hint: t.nowSuffix,
      value: kpis.activeMemberships,
      dot: "bg-brand-500",
      accent: true,
    },
    {
      label: t.attendance,
      hint: t.hintAttendance,
      value: metrics.attendance,
      dot: "bg-emerald-500",
    },
    {
      label: t.revenue,
      hint: t.hintRevenue,
      value: formatPrice(metrics.revenue, metrics.currency, lang),
      dot: "bg-emerald-500",
      accent: true,
    },
    {
      label: t.membershipsSold,
      hint: t.hintMembershipsSold,
      value: metrics.membershipsSold,
      dot: "bg-violet-500",
    },
    {
      label: t.newMembers,
      hint: t.hintNewMembers,
      value: metrics.newMembers,
      dot: "bg-amber-500",
    },
    {
      label: t.sessionsHeld,
      hint: t.hintSessionsHeld,
      value: metrics.sessionsHeld,
      dot: "bg-sky-500",
    },
  ];

  // Real numbers, just not headline material. Kept rather than dropped —
  // outstanding sessions in particular is money already taken and still owed
  // back in classes.
  const secondary: Tile[] = [
    {
      label: t.outstandingSessions,
      hint: t.hintOutstandingSessions,
      value: kpis.outstandingSessions,
      dot: "bg-amber-500",
    },
    { label: t.totalMembers, hint: t.hintTotalMembers, value: kpis.totalMembers, dot: "bg-sky-500" },
    {
      label: t.todaySessions,
      hint: t.hintTodaySessions,
      value: kpis.todaySessions,
      dot: "bg-emerald-500",
    },
    { label: t.bookings, hint: t.hintBookings, value: metrics.bookings, dot: "bg-mauve-400" },
  ];

  const dimmed = pending ? "opacity-50" : "";

  return (
    <div className="space-y-5">
      {/* The picker, stated once. The period used to be spelled out in three
          places at the same time — the button row, the block heading, and a date
          echo — which is how you end up unsure which numbers it governs. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="seg" role="group" aria-label={t.pickPeriod}>
          {PRESETS.map((p) => {
            const on = preset === p.key;
            return (
              <button
                key={p.key}
                onClick={() => choose(p.key)}
                aria-pressed={on}
                className={`seg-item ${on ? "seg-item-on" : ""}`}
              >
                {t[p.labelKey]}
              </button>
            );
          })}
          <button
            onClick={() => setShowDates((v) => !v)}
            aria-pressed={preset === "custom"}
            aria-expanded={showDates}
            className={`seg-item ${preset === "custom" ? "seg-item-on" : ""}`}
          >
            <span aria-hidden>&#128197;</span>
            {t.custom}
          </button>
        </div>
        <p className="text-xs tabular-nums text-mauve-400">
          {startDate} — {endDate}
        </p>
      </div>

      {showDates && (
        <div className="panel flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label">{t.from}</label>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">{t.to}</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </div>
          <button onClick={applyCustom} disabled={pending} className="btn-primary">
            {t.apply}
          </button>
        </div>
      )}

      <div
        className={`grid grid-cols-2 gap-3 transition-opacity duration-200 lg:grid-cols-3 xl:grid-cols-6 ${dimmed}`}
      >
        {headline.map((c) => (
          <StatTile key={c.label} c={c} />
        ))}
      </div>

      <div className={`grid gap-4 transition-opacity duration-200 lg:grid-cols-2 ${dimmed}`}>
        <BarChartCard
          title={t.chartCheckins}
          total={String(series.checkinsTotal)}
          buckets={series.buckets}
          pick={(b) => b.checkins}
          color="#e0115f"
        />
        <BarChartCard
          title={t.chartRevenue}
          total={formatPrice(series.revenueTotal, series.currency, lang)}
          buckets={series.buckets}
          pick={(b) => b.revenue}
          color="#10b981"
          footer={
            /* How the money came in. Cash and card always show; transfer and
               free only when non-zero, so the row is not four noughts. */
            <div className="mt-4 grid grid-cols-2 gap-2">
              {(
                [
                  ["cash", t.payCash, "#10b981"],
                  ["card", t.payCard, "#0ea5e9"],
                  ["transfer", t.payTransfer, "#8b5cf6"],
                  ["free", t.payFree, "#9d959c"],
                ] as const
              )
                .filter(([k]) => k === "cash" || k === "card" || series.byMethod[k] > 0)
                .map(([k, label, dot]) => (
                  <div
                    key={k}
                    className="flex items-center justify-between gap-2 rounded-xl border border-mauve-200/70 bg-mauve-50/50 px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: dot }}
                        aria-hidden
                      />
                      <span className="truncate text-xs font-semibold text-mauve-600">{label}</span>
                    </span>
                    <span className="shrink-0 text-sm font-bold tabular-nums text-mauve-900">
                      {formatPrice(series.byMethod[k], series.currency, lang)}
                    </span>
                  </div>
                ))}
            </div>
          }
        />
      </div>

      <div
        className={`grid grid-cols-2 gap-3 transition-opacity duration-200 lg:grid-cols-4 ${dimmed}`}
      >
        {secondary.map((c) => (
          <StatTile key={c.label} c={c} />
        ))}
      </div>
    </div>
  );
}
