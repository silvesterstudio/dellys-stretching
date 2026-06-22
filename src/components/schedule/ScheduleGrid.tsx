"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { SessionWithType } from "@/lib/queries";
import { TIMEZONE, type Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatTime } from "@/lib/format";
import { dayKey } from "@/lib/week";
import { localized } from "@/lib/i18n-data";

export function ScheduleGrid({
  lang,
  dict,
  days,
  initialSessions,
}: {
  lang: Locale;
  dict: Dictionary;
  days: string[];
  initialSessions: SessionWithType[];
}) {
  const [sessions, setSessions] = useState(initialSessions);

  useEffect(() => setSessions(initialSessions), [initialSessions]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    const channel = supabase
      .channel("sessions-occupancy")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions" },
        (payload) => {
          const n = payload.new as {
            id: string;
            booked_count: number;
            capacity: number;
            status: string;
          };
          setSessions((prev) =>
            prev
              .map((s) =>
                s.id === n.id
                  ? { ...s, booked_count: n.booked_count, capacity: n.capacity, status: n.status }
                  : s,
              )
              .filter((s) => s.status === "scheduled"),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const byDay = new Map<string, SessionWithType[]>();
  for (const s of sessions) {
    const k = dayKey(s.starts_at);
    const arr = byDay.get(k) ?? [];
    arr.push(s);
    byDay.set(k, arr);
  }

  if (sessions.length === 0) {
    return (
      <div className="card animate-rise p-12 text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-mauve-100 text-2xl">
          🗓️
        </div>
        <p className="text-mauve-500">{dict.schedule.noSessions}</p>
      </div>
    );
  }

  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "ro-RO", {
      ...opts,
      timeZone: TIMEZONE,
    }).format(new Date(iso));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((dISO) => {
        const k = dayKey(dISO);
        const daySessions = byDay.get(k) ?? [];
        const empty = daySessions.length === 0;
        return (
          <div
            key={k}
            className={`min-w-0 ${empty ? "hidden lg:block" : ""}`}
          >
            <div className="mb-2 flex items-baseline justify-between border-b border-mauve-100 pb-1.5 lg:justify-center lg:gap-1.5">
              <span className="text-sm font-semibold capitalize text-mauve-800">
                {fmt(dISO, { weekday: "short" })}
              </span>
              <span className="text-xs text-mauve-400">
                {fmt(dISO, { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
            <div className="space-y-2.5">
              {empty ? (
                <div className="rounded-2xl border border-dashed border-mauve-100 py-6 text-center text-[11px] text-mauve-300">
                  —
                </div>
              ) : (
                daySessions.map((s) => (
                  <SessionCard key={s.id} s={s} lang={lang} dict={dict} time={formatTime(s.starts_at, lang)} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SessionCard({
  s,
  lang,
  dict,
  time,
}: {
  s: SessionWithType;
  lang: Locale;
  dict: Dictionary;
  time: string;
}) {
  const left = Math.max(0, s.capacity - s.booked_count);
  const full = left <= 0;
  const isPast = new Date(s.starts_at).getTime() <= Date.now();
  const name = localized(s.class_type, "name", lang);
  const pct = Math.min(100, Math.round((s.booked_count / Math.max(1, s.capacity)) * 100));

  return (
    <div className="card card-hover animate-rise overflow-hidden p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="font-display text-lg font-bold leading-none text-mauve-900">
          {time}
        </span>
        <span
          className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: s.class_type.color }}
        />
      </div>

      <div className="mt-1.5 truncate text-sm font-semibold text-mauve-800">{name}</div>
      <div className="flex items-center gap-1.5 text-[11px] text-mauve-400">
        {s.class_type.audience === "child" && (
          <span className="badge bg-mauve-100 px-1.5 py-0 text-mauve-600">
            {dict.audience.child}
          </span>
        )}
        {s.instructor && <span className="truncate">{s.instructor}</span>}
      </div>

      {/* occupancy bar */}
      <div className="mt-2.5">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-mauve-100">
          <div
            className={`h-full rounded-full ${full ? "bg-mauve-300" : "bg-brand-400"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className={`text-[11px] font-medium ${full ? "text-mauve-400" : "text-brand-600"}`}>
            {full ? dict.common.full : `${left} ${dict.common.spotsLeft}`}
          </span>
          <span className="text-[10px] text-mauve-300">
            {s.booked_count}/{s.capacity}
          </span>
        </div>
      </div>

      {!isPast && !full && (
        <Link
          href={`/${lang}/book/${s.id}`}
          className="btn-primary mt-3 w-full px-3 py-2 text-xs"
        >
          {dict.schedule.bookCta}
        </Link>
      )}
    </div>
  );
}
