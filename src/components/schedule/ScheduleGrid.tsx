"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { SessionWithType } from "@/lib/queries";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatTime } from "@/lib/format";
import { dayKey } from "@/lib/week";
import { localized } from "@/lib/i18n-data";

export function ScheduleGrid({
  lang,
  dict,
  days,
  initialSessions,
  loggedIn,
}: {
  lang: Locale;
  dict: Dictionary;
  days: string[]; // ISO day starts (Mon..Sun)
  initialSessions: SessionWithType[];
  loggedIn: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  // Live occupancy: patch booked_count / capacity / status as bookings happen.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("sessions-occupancy")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sessions" },
        (payload) => {
          const next = payload.new as {
            id: string;
            booked_count: number;
            capacity: number;
            status: string;
          };
          setSessions((prev) =>
            prev
              .map((s) =>
                s.id === next.id
                  ? { ...s, booked_count: next.booked_count, capacity: next.capacity, status: next.status }
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
    (byDay.get(k) ?? byDay.set(k, []).get(k)!).push(s);
  }

  const hasAny = sessions.length > 0;

  return (
    <div>
      {!hasAny && (
        <p className="rounded-2xl bg-white p-10 text-center text-mauve-400">
          {dict.schedule.noSessions}
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((dISO) => {
          const k = dayKey(dISO);
          const dayDate = new Date(dISO);
          const weekday = new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "ro-RO", {
            weekday: "short",
            timeZone: "Europe/Bucharest",
          }).format(dayDate);
          const dayNum = new Intl.DateTimeFormat(lang === "ru" ? "ru-RU" : "ro-RO", {
            day: "2-digit",
            month: "2-digit",
            timeZone: "Europe/Bucharest",
          }).format(dayDate);
          const daySessions = byDay.get(k) ?? [];
          if (!hasAny) return null;
          return (
            <div key={k} className="min-w-0">
              <div className="mb-2 text-center">
                <div className="text-sm font-semibold capitalize text-mauve-800">{weekday}</div>
                <div className="text-xs text-mauve-400">{dayNum}</div>
              </div>
              <div className="space-y-2">
                {daySessions.length === 0 && (
                  <div className="rounded-xl border border-dashed border-mauve-100 py-4" />
                )}
                {daySessions.map((s) => (
                  <SessionCard
                    key={s.id}
                    s={s}
                    lang={lang}
                    dict={dict}
                    loggedIn={loggedIn}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SessionCard({
  s,
  lang,
  dict,
  loggedIn,
}: {
  s: SessionWithType;
  lang: Locale;
  dict: Dictionary;
  loggedIn: boolean;
}) {
  const left = Math.max(0, s.capacity - s.booked_count);
  const full = left <= 0;
  const isPast = new Date(s.starts_at).getTime() <= Date.now();
  const name = localized(s.class_type, "name", lang);
  const bookHref = loggedIn
    ? `/${lang}/book/${s.id}`
    : `/${lang}/login?session=${s.id}`;

  return (
    <div
      className="card overflow-hidden p-3"
      style={{ borderLeft: `4px solid ${s.class_type.color}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-mauve-900">
          {formatTime(s.starts_at, lang)}
        </span>
        {s.class_type.audience === "child" && (
          <span className="badge bg-mauve-100 text-mauve-700">{dict.audience.child}</span>
        )}
      </div>
      <div className="mt-0.5 truncate text-sm text-mauve-800">{name}</div>
      {s.instructor && (
        <div className="truncate text-xs text-mauve-400">{s.instructor}</div>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span
          className={
            full
              ? "badge bg-mauve-100 text-mauve-500"
              : "badge bg-brand-50 text-brand-700"
          }
        >
          {full ? dict.common.full : `${left} ${dict.common.spotsLeft}`}
        </span>
        <span className="text-[11px] text-mauve-400">
          {s.booked_count}/{s.capacity}
        </span>
      </div>
      {!isPast && !full && (
        <Link href={bookHref} className="btn-primary mt-2 w-full py-1.5 text-xs">
          {dict.schedule.bookCta}
        </Link>
      )}
    </div>
  );
}
