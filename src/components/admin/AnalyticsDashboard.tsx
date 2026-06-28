"use client";

import { useState, useTransition } from "react";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatPrice } from "@/lib/format";
import type { RangePreset, WindowMetrics, KpiMetrics } from "@/lib/admin-analytics";
import { getMetricsAction } from "@/app/[lang]/admin/dashboard/actions";

const PRESETS: { key: RangePreset; labelKey: keyof Dictionary["admin"]["stats"] }[] = [
  { key: "today", labelKey: "today" },
  { key: "yesterday", labelKey: "yesterday" },
  { key: "7d", labelKey: "last7" },
  { key: "30d", labelKey: "last30" },
  { key: "365d", labelKey: "last365" },
  { key: "custom", labelKey: "custom" },
];

export function AnalyticsDashboard({
  lang,
  dict,
  kpis,
  initialMetrics,
  initialPreset,
  initialStart,
  initialEnd,
}: {
  lang: Locale;
  dict: Dictionary;
  kpis: KpiMetrics;
  initialMetrics: WindowMetrics;
  initialPreset: RangePreset;
  initialStart: string;
  initialEnd: string;
}) {
  const t = dict.admin.stats;
  const [preset, setPreset] = useState<RangePreset>(initialPreset);
  const [metrics, setMetrics] = useState(initialMetrics);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [pending, startTransition] = useTransition();

  function choose(p: RangePreset) {
    setPreset(p);
    if (p === "custom") return; // wait for the user to pick dates + Apply
    startTransition(async () => {
      const res = await getMetricsAction({ preset: p });
      setMetrics(res.metrics);
      setStartDate(res.startDate);
      setEndDate(res.endDate);
    });
  }

  function applyCustom() {
    startTransition(async () => {
      const res = await getMetricsAction({ preset: "custom", startDate, endDate });
      setMetrics(res.metrics);
      setStartDate(res.startDate);
      setEndDate(res.endDate);
    });
  }

  const kpiCards = [
    { label: t.activeMemberships, value: kpis.activeMemberships, accent: true },
    { label: t.outstandingSessions, value: kpis.outstandingSessions },
    { label: t.totalMembers, value: kpis.totalMembers },
    { label: t.todaySessions, value: kpis.todaySessions },
  ];

  const windowCards = [
    {
      label: t.revenue,
      value: formatPrice(metrics.revenue, metrics.currency, lang),
      highlight: true,
    },
    { label: t.membershipsSold, value: metrics.membershipsSold },
    { label: t.sessionsHeld, value: metrics.sessionsHeld },
    { label: t.attendance, value: metrics.attendance },
    { label: t.newMembers, value: metrics.newMembers },
    { label: t.bookings, value: metrics.bookings },
  ];

  return (
    <div className="space-y-8">
      {/* Always-current snapshot */}
      <section>
        <h2 className="eyebrow mb-3">{t.overview}</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpiCards.map((c) => (
            <div key={c.label} className="card p-4">
              <div
                className={`font-display text-3xl font-bold leading-none ${
                  c.accent ? "text-brand-600" : "text-mauve-900"
                }`}
              >
                {c.value}
              </div>
              <div className="mt-2 text-xs font-medium text-mauve-500">{c.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Period picker */}
      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => choose(p.key)}
              className={
                preset === p.key
                  ? "btn-primary px-4 py-2 text-sm"
                  : "btn-secondary px-4 py-2 text-sm"
              }
            >
              {t[p.labelKey]}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="card flex flex-wrap items-end gap-3 p-4">
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

        <p className="text-xs text-mauve-400">
          {startDate} — {endDate} · {t.inPeriod}
        </p>
      </section>

      {/* Window stats */}
      <section
        className={`grid grid-cols-2 gap-3 transition-opacity duration-200 lg:grid-cols-3 ${
          pending ? "opacity-50" : ""
        }`}
      >
        {windowCards.map((c) => (
          <div key={c.label} className="card p-5">
            <div
              className={`font-display text-3xl font-bold leading-none ${
                c.highlight ? "text-brand-600" : "text-mauve-900"
              }`}
            >
              {c.value}
            </div>
            <div className="mt-2 text-sm text-mauve-500">{c.label}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
