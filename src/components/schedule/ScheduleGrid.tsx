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

  // Client-side audience filter (All / Adults / Kids). "child" covers both kids
  // groups; adult classes are hidden under "Kids" and vice-versa.
  const [audience, setAudience] = useState<"all" | "adult" | "child">("all");
  const visible =
    audience === "all"
      ? sessions
      : sessions.filter((s) => s.class_type.audience === audience);

  const byDay = new Map<string, SessionWithType[]>();
  for (const s of visible) {
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

  const filters: { key: "all" | "adult" | "child"; label: string }[] = [
    { key: "all", label: dict.schedule.filterAll },
    { key: "adult", label: dict.schedule.filterAdults },
    { key: "child", label: dict.schedule.filterKids },
  ];

  // One card per day, Monday–Saturday. Always render all six so the week reads
  // as a complete grid even where a day has no sessions yet.
  return (
    <div className="space-y-6">
      <div
        role="group"
        aria-label={dict.schedule.title}
        className="mx-auto flex w-fit items-center gap-1 rounded-full border border-mauve-200 bg-white p-1"
      >
        {filters.map((f) => {
          const active = audience === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setAudience(f.key)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 ${
                active ? "bg-brand-600 text-white" : "text-mauve-600 hover:bg-mauve-100"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <div className="card p-10 text-center text-sm text-mauve-400">
          {dict.schedule.noSessionsWeek}
        </div>
      ) : (
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
      )}
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
  const audienceLabel =
    s.class_type.audience === "child" ? dict.audience.child : dict.audience.adult;

  return (
    <li className="border-t border-mauve-100 pt-3 first:border-t-0 first:pt-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-lg font-bold leading-none text-mauve-900">{time}</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-medium">
          {full ? (
            <span className="text-mauve-400">{dict.common.full}</span>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              <span className="text-mauve-500">
                {left} {dict.common.spotsLeft}
              </span>
            </>
          )}
        </span>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ backgroundColor: s.class_type.color }}
        />
        <span className="truncate text-sm font-semibold text-mauve-800">{name}</span>
      </div>
      <div className="mt-0.5 truncate text-xs text-mauve-400">
        {audienceLabel}
        {s.instructor ? ` · ${s.instructor}` : ""}
      </div>

      {!isPast &&
        (full ? (
          <button
            disabled
            className="btn-secondary mt-3 w-full cursor-not-allowed px-3 py-2 text-xs opacity-60"
          >
            {dict.common.full}
          </button>
        ) : (
          <Link
            href={loggedIn ? `/${lang}/book/${s.id}` : `/${lang}/login?session=${s.id}`}
            className="btn-primary mt-3 w-full px-3 py-2 text-xs"
          >
            {dict.schedule.bookCta}
          </Link>
        ))}
    </li>
  );
}
