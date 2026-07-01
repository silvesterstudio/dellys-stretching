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
import { DC } from "@/lib/dc";

const btnBase: React.CSSProperties = {
  display: "block",
  width: "100%",
  textAlign: "center",
  marginTop: 13,
  padding: "11px 12px",
  borderRadius: 999,
  fontWeight: 700,
  fontSize: 14,
  fontFamily: DC.sans,
  textDecoration: "none",
  border: "none",
};

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
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  useEffect(() => setSessions(initialSessions), [initialSessions]);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refetch = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const fresh = await refreshScheduleAction(weekStartISO, weekEndISO);
        if (Array.isArray(fresh)) setSessions(fresh);
      }, 300);
    };
    const channel = supabase
      .channel("sessions-occupancy")
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions" }, refetch)
      .subscribe();
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
  }, [weekStartISO, weekEndISO]);

  const [audience, setAudience] = useState<"all" | "adult" | "child">("all");
  const visible =
    audience === "all" ? sessions : sessions.filter((s) => s.class_type.audience === audience);

  const byDay = new Map<string, SessionWithType[]>();
  for (const s of visible) {
    const k = dayKey(s.starts_at);
    const arr = byDay.get(k) ?? [];
    arr.push(s);
    byDay.set(k, arr);
  }

  const intlLocale = lang === "ru" ? "ru-RU" : "ro-RO";
  const dayName = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: "long", timeZone: TIMEZONE })
      .format(new Date(iso))
      .toUpperCase();
  // "17 IUN" / "17 ИЮН" — the calendar date of each weekday card.
  const dayDate = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, { day: "numeric", month: "short", timeZone: TIMEZONE })
      .format(new Date(iso))
      .replace(".", "")
      .toUpperCase();

  // Only days that actually have (filtered) sessions — matches the design.
  const dayCards = days
    .map((dISO) => ({ dISO, k: dayKey(dISO), slots: byDay.get(dayKey(dISO)) ?? [] }))
    .filter((d) => d.slots.length > 0);

  const filters: { key: "all" | "adult" | "child"; label: string }[] = [
    { key: "all", label: dict.schedule.filterAll },
    { key: "adult", label: dict.schedule.filterAdults },
    { key: "child", label: dict.schedule.filterKids },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
        <div
          role="group"
          aria-label={dict.schedule.title}
          style={{
            display: "inline-flex",
            background: "#fff",
            border: `1px solid ${DC.border}`,
            borderRadius: 999,
            padding: 5,
            gap: 2,
          }}
        >
          {filters.map((f) => {
            const active = audience === f.key;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => setAudience(f.key)}
                style={{
                  border: "none",
                  cursor: "pointer",
                  padding: "9px 20px",
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 14,
                  fontFamily: DC.sans,
                  background: active ? DC.accent : "transparent",
                  color: active ? "#fff" : DC.muted,
                  transition: "all .2s",
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>
      </div>

      {dayCards.length === 0 ? (
        <div
          style={{
            maxWidth: 480,
            margin: "0 auto",
            textAlign: "center",
            padding: "40px 24px",
            border: `1px solid ${DC.border}`,
            borderRadius: DC.radius,
            color: DC.faint,
            fontSize: 14,
          }}
        >
          {dict.schedule.noSessionsWeek}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: 22,
            alignItems: "start",
          }}
        >
          {dayCards.map(({ dISO, k, slots }) => (
            <div
              key={k}
              style={{
                background: "#fff",
                border: `1px solid ${DC.border}`,
                borderRadius: DC.radius,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "2px 4px 16px",
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 13,
                    letterSpacing: ".13em",
                    textTransform: "uppercase",
                    color: DC.ink,
                  }}
                >
                  {dayName(dISO)}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: 12,
                    letterSpacing: ".1em",
                    color: DC.faint,
                  }}
                >
                  {dayDate(dISO)}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {slots.map((s) => (
                  <Slot key={s.id} s={s} lang={lang} dict={dict} now={now} loggedIn={loggedIn} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Slot({
  s,
  lang,
  dict,
  now,
  loggedIn,
}: {
  s: SessionWithType;
  lang: Locale;
  dict: Dictionary;
  now: number | null;
  loggedIn: boolean;
}) {
  const left = Math.max(0, s.capacity - s.booked_count);
  const full = left <= 0;
  const isPast = now !== null && new Date(s.starts_at).getTime() <= now;
  const name = localized(s.class_type, "name", lang);
  const grp = s.class_type.audience === "child" ? dict.audience.child : dict.audience.adult;
  const time = formatTime(s.starts_at, lang);
  const dotColor = full ? "#C9C7CF" : left <= 2 ? DC.accent : DC.green;
  const spotsText = full ? dict.common.full : `${left} ${dict.common.spotsLeft}`;

  return (
    <div style={{ border: `1px solid ${DC.border2}`, borderRadius: 16, padding: "18px 18px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: DC.display, fontWeight: 600, fontSize: 20, color: DC.ink }}>
          {time}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: DC.muted2,
          }}
        >
          <span style={{ width: 7, height: 7, borderRadius: 999, background: dotColor }} />
          {spotsText}
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: DC.ink }}>{name}</div>
        <div style={{ fontSize: 13, color: DC.faint, marginTop: 1 }}>{grp}</div>
      </div>

      {isPast ? (
        <div style={{ ...btnBase, background: "#F7F6F8", color: "#B4B2BB", cursor: "default" }}>
          {dict.schedule.ended}
        </div>
      ) : full ? (
        <div style={{ ...btnBase, background: "#F3F2F5", color: "#AEACB4", cursor: "not-allowed" }}>
          {dict.common.full}
        </div>
      ) : (
        <Link
          href={loggedIn ? `/${lang}/book/${s.id}` : `/${lang}/login?session=${s.id}`}
          style={{ ...btnBase, background: DC.accent, color: "#fff" }}
        >
          {dict.schedule.bookCta}
        </Link>
      )}
    </div>
  );
}
