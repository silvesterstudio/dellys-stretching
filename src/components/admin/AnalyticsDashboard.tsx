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

  // Two blocks of numbers used to sit one above the other in identical cards:
  // the first is the state of the business right now, the second is whatever
  // window is selected. Nothing on screen said which was which, and "Sesiuni
  // azi" sat four cards away from "Sesiuni", meaning different things. Each
  // tile now states what it counts, and the two blocks are labelled and spaced
  // so they cannot be read as one list.
  const kpiCards = [
    { label: t.activeMemberships, hint: t.hintActiveMemberships, value: kpis.activeMemberships, accent: true, dot: "bg-brand-500" },
    { label: t.outstandingSessions, hint: t.hintOutstandingSessions, value: kpis.outstandingSessions, dot: "bg-amber-500" },
    { label: t.totalMembers, hint: t.hintTotalMembers, value: kpis.totalMembers, dot: "bg-sky-500" },
    { label: t.todaySessions, hint: t.hintTodaySessions, value: kpis.todaySessions, dot: "bg-emerald-500" },
  ];

  const windowCards = [
    {
      label: t.revenue,
      hint: t.hintRevenue,
      value: formatPrice(metrics.revenue, metrics.currency, lang),
      highlight: true,
      dot: "bg-emerald-500",
    },
    { label: t.membershipsSold, hint: t.hintMembershipsSold, value: metrics.membershipsSold, dot: "bg-brand-500" },
    { label: t.sessionsHeld, hint: t.hintSessionsHeld, value: metrics.sessionsHeld, dot: "bg-sky-500" },
    { label: t.attendance, hint: t.hintAttendance, value: metrics.attendance, dot: "bg-violet-500" },
    { label: t.newMembers, hint: t.hintNewMembers, value: metrics.newMembers, dot: "bg-amber-500" },
    { label: t.bookings, hint: t.hintBookings, value: metrics.bookings, dot: "bg-mauve-400" },
  ];

  // The heading of the second block names the window, so the numbers under it
  // can never be mistaken for today's.
  const presetLabel = PRESETS.find((x) => x.key === preset);
  const periodName =
    preset === "custom" || !presetLabel ? `${startDate} — ${endDate}` : t[presetLabel.labelKey];

  return (
    <div className="space-y-8">
      {/* Block one: the state of the business, independent of any date range. */}
      <section>
        <div className="mb-3">
          <h2 className="font-display text-lg font-bold text-mauve-900">{t.nowTitle}</h2>
          <p className="text-xs text-mauve-400">{t.nowHint}</p>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpiCards.map((c) => (
            <div key={c.label} className="card p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} aria-hidden />
                <span className="truncate text-sm font-semibold text-mauve-700">{c.label}</span>
              </div>
              <div
                className={`mt-2 font-display text-[clamp(1.75rem,5vw,2.5rem)] font-bold leading-none tabular-nums ${
                  c.accent ? "text-brand-600" : "text-mauve-900"
                }`}
              >
                {c.value}
              </div>
              <div className="mt-1.5 text-xs leading-snug text-mauve-400">{c.hint}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Block two: the picker and the numbers it controls, inside one framed
          group — floating between the two blocks, it was unclear which set of
          numbers it changed. */}
      <section className="rounded-3xl border border-mauve-200/70 bg-mauve-50/40 p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="font-display text-lg font-bold text-mauve-900">
            {t.periodTitle}: <span className="text-brand-600">{periodName}</span>
          </h2>
          <p className="text-xs text-mauve-400">{t.pickPeriod}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => choose(p.key)}
              className={
                preset === p.key
                  ? "btn-primary min-h-[44px] px-4 text-sm"
                  : "btn-secondary min-h-[44px] px-4 text-sm"
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
            <button onClick={applyCustom} disabled={pending} className="btn-primary min-h-[44px]">
              {t.apply}
            </button>
          </div>
        )}

        <p className="mt-3 text-xs text-mauve-400">
          {startDate} — {endDate}
        </p>

        <div
          className={`mt-4 grid grid-cols-2 gap-3 transition-opacity duration-200 lg:grid-cols-3 ${
            pending ? "opacity-50" : ""
          }`}
        >
          {windowCards.map((c) => (
            <div key={c.label} className="card p-5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${c.dot}`} aria-hidden />
                <span className="truncate text-sm font-semibold text-mauve-700">{c.label}</span>
              </div>
              <div
                className={`mt-2 font-display text-[clamp(1.75rem,5vw,2.5rem)] font-bold leading-none tabular-nums ${
                  c.highlight ? "text-brand-600" : "text-mauve-900"
                }`}
              >
                {c.value}
              </div>
              <div className="mt-1.5 text-xs leading-snug text-mauve-400">{c.hint}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
