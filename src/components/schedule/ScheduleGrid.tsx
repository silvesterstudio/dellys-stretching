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
import { refreshScheduleAction } from "@/app/[lang]/actions";

export function ScheduleGrid({
  lang,
  dict,
  days,
  initialSessions,
  weekStartISO,
  weekEndISO,
  loggedIn,
}: {
  lang: Locale;
  dict: Dictionary;
  days: string[];
  initialSessions: SessionWithType[];
  weekStartISO: string;
  weekEndISO: string;
  loggedIn: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  // `now` stays null on the server and the first client paint so time-relative
  // UI (the Book CTA) renders identically on both, avoiding hydration mismatch.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  useEffect(() => setSessions(initialSessions), [initialSessions]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Any change to the sessions table (new class, cancellation, occupancy)
    // triggers a debounced re-fetch of the whole visible week. Re-fetching
    // (rather than patching one row) is the only way INSERTs/DELETEs show up,
    // and it carries the joined class_type the realtime payload lacks.
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const fresh = await refreshScheduleAction(weekStartISO, weekEndISO);
        if (Array.isArray(fresh)) setSessions(fresh);
      }, 300);
    };
    const channel = supabase
      .channel("sessions-occupancy")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions" },
        refetch,
      )
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [weekStartISO, weekEndISO]);

  const byDay = new Map<string, SessionWithType[]>();
  for (const s of sessions) {
    const k = dayKey(s.starts_at);
    const arr = byDay.get(k) ?? [];
    arr.push(s);
    byDay.set(k, arr);
  }

  const fmt = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "ro-RO", {
      ...opts,
      timeZone: TIMEZONE,
    }).format(new Date(iso));

  // One card per day, Monday–Saturday. Always render all six so the week reads
  // as a complete grid even where a day has no sessions yet.
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {days.map((dISO) => {
        const k = dayKey(dISO);
        const daySessions = byDay.get(k) ?? [];
        const empty = daySessions.length === 0;
        return (
          <div key={k} className="card animate-rise flex flex-col p-4">
            <div className="mb-3 flex items-baseline justify-between border-b border-mauve-100 pb-2">
              <span className="font-display text-base font-semibold capitalize text-mauve-900">
                {fmt(dISO, { weekday: "long" })}
              </span>
              <span className="text-xs font-medium text-mauve-400">
                {fmt(dISO, { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
            {empty ? (
              <p className="grid flex-1 place-items-center py-6 text-center text-xs text-mauve-400">
                {dict.schedule.noSessionsDay}
              </p>
            ) : (
              <ul className="space-y-3">
                {daySessions.map((s) => (
                  <SessionRow
                    key={s.id}
                    s={s}
                    lang={lang}
                    dict={dict}
                    now={now}
                    loggedIn={loggedIn}
                    time={formatTime(s.starts_at, lang)}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

function SessionRow({
  s,
  lang,
  dict,
  now,
  loggedIn,
  time,
}: {
  s: SessionWithType;
  lang: Locale;
  dict: Dictionary;
  now: number | null;
  loggedIn: boolean;
  time: string;
}) {
  const left = Math.max(0, s.capacity - s.booked_count);
  const full = left <= 0;
  // null until mounted (see ScheduleGrid) — treat as "not past" so the server
  // and first client render agree.
  const isPast = now !== null && new Date(s.starts_at).getTime() <= now;
  const name = localized(s.class_type, "name", lang);
  const pct = Math.min(100, Math.round((s.booked_count / Math.max(1, s.capacity)) * 100));

  return (
    <li className="border-t border-mauve-100 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="font-display text-lg font-bold leading-none text-mauve-900">{time}</span>
          <div className="mt-1 truncate text-sm font-semibold text-mauve-800">{name}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-mauve-400">
            {s.class_type.audience === "child" && (
              <span className="badge bg-mauve-100 px-1.5 py-0 text-mauve-600">{dict.audience.child}</span>
            )}
            {s.instructor && <span className="truncate">{s.instructor}</span>}
          </div>
        </div>
        <span
          className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: s.class_type.color }}
        />
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
          <span className="text-[10px] text-mauve-500">
            {s.booked_count}/{s.capacity}
          </span>
        </div>
      </div>

      {!isPast && !full && (
        <Link
          href={loggedIn ? `/${lang}/book/${s.id}` : `/${lang}/login?session=${s.id}`}
          className="btn-primary mt-3 w-full px-3 py-2 text-xs"
        >
          {dict.schedule.bookCta}
        </Link>
      )}
    </li>
  );
}
