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
import { GuestBookingModal } from "@/components/booking/GuestBookingModal";
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

  // Accordion open/closed per day. Days already behind us start collapsed;
  // today and everything after (including all of next week) start expanded.
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const todayK = dayKey(new Date());
    return Object.fromEntries(days.map((d) => [dayKey(d), dayKey(d) >= todayK]));
  });
  const toggleDay = (k: string) => setExpanded((prev) => ({ ...prev, [k]: !prev[k] }));

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

  // Audience toggle: Adults / Kids only (no "all") — defaults to adults.
  const [audience, setAudience] = useState<"adult" | "child">("adult");
  const visible = sessions.filter((s) => s.class_type.audience === audience);

  // Anonymous "Rezervă" opens a name+phone popup instead of navigating away.
  const [guestSession, setGuestSession] = useState<SessionWithType | null>(null);
  const bumpBooked = (id: string) =>
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, booked_count: s.booked_count + 1 } : s)),
    );

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

  // Every day gets an accordion section — empty days show a placeholder so
  // the fortnight keeps the same rhythm regardless of how full it is.
  const dayCards = days.map((dISO) => ({ dISO, k: dayKey(dISO), slots: byDay.get(dayKey(dISO)) ?? [] }));

  const filters: { key: "adult" | "child"; label: string }[] = [
    { key: "adult", label: dict.schedule.filterAdults },
    { key: "child", label: dict.schedule.filterKids },
  ];

  return (
    <div>
      {/* Kids sessions get a slow colour-cycling border. */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes dc-kids-rgb{0%{border-color:#FF5C8A}25%{border-color:#9B6BFF}50%{border-color:#38C6FF}75%{border-color:#4EE08A}100%{border-color:#FF5C8A}}
.dc-kids{animation:dc-kids-rgb 8s linear infinite}
@media (prefers-reduced-motion:reduce){.dc-kids{animation:none}}
`,
        }}
      />
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

      <div
        style={{
          maxWidth: 860,
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {dayCards.map(({ dISO, k, slots }, i) => {
          const open = !!expanded[k];
          return (
            <div key={k} style={{ display: "contents" }}>
              {/* Divider between the current week (7 days) and the next one. */}
              {i === 7 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    margin: "14px 0 4px",
                  }}
                >
                  <span style={{ flex: 1, height: 1, background: DC.border }} />
                  <span
                    style={{
                      fontWeight: 700,
                      fontSize: 12,
                      letterSpacing: ".13em",
                      textTransform: "uppercase",
                      color: DC.faint,
                    }}
                  >
                    {dict.schedule.nextWeek}
                  </span>
                  <span style={{ flex: 1, height: 1, background: DC.border }} />
                </div>
              )}
              <div
                style={{
                  background: "#fff",
                  border: `1px solid ${DC.border}`,
                  borderRadius: DC.radius,
                }}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={`day-${k}`}
                  onClick={() => toggleDay(k)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    width: "100%",
                    padding: "18px 22px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontFamily: DC.sans,
                    textAlign: "left",
                  }}
                >
                  <span style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
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
                  </span>
                  <svg
                    aria-hidden
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    style={{
                      flex: "none",
                      color: DC.faint,
                      transform: open ? "rotate(180deg)" : "none",
                      transition: "transform .25s ease",
                    }}
                  >
                    <path
                      d="M3 6l5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                {/* 0fr→1fr grid rows animate the fold without measuring heights. */}
                <div
                  id={`day-${k}`}
                  style={{
                    display: "grid",
                    gridTemplateRows: open ? "1fr" : "0fr",
                    transition: "grid-template-rows .28s ease",
                  }}
                >
                  <div style={{ overflow: "hidden" }}>
                    {slots.length === 0 ? (
                      <div style={{ padding: "0 22px 20px" }}>
                        <div
                          style={{
                            border: `1px dashed ${DC.border}`,
                            borderRadius: 16,
                            color: DC.faint,
                            fontSize: 13.5,
                            textAlign: "center",
                            padding: 16,
                          }}
                        >
                          {dict.schedule.noSessionsDay}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))",
                          gap: 12,
                          padding: "0 22px 20px",
                        }}
                      >
                        {slots.map((s) => (
                          <Slot
                            key={s.id}
                            s={s}
                            lang={lang}
                            dict={dict}
                            now={now}
                            loggedIn={loggedIn}
                            onReserve={setGuestSession}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {guestSession && (
        <GuestBookingModal
          lang={lang}
          dict={dict}
          sessionId={guestSession.id}
          className={localized(guestSession.class_type, "name", lang)}
          timeLabel={formatTime(guestSession.starts_at, lang)}
          isChild={guestSession.class_type.audience === "child"}
          onClose={() => setGuestSession(null)}
          onBooked={bumpBooked}
        />
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
  onReserve,
}: {
  s: SessionWithType;
  lang: Locale;
  dict: Dictionary;
  now: number | null;
  loggedIn: boolean;
  onReserve: (s: SessionWithType) => void;
}) {
  const left = Math.max(0, s.capacity - s.booked_count);
  const full = left <= 0;
  const isPast = now !== null && new Date(s.starts_at).getTime() <= now;
  const name = localized(s.class_type, "name", lang);
  const grp = s.class_type.audience === "child" ? dict.audience.child : dict.audience.adult;
  const time = formatTime(s.starts_at, lang);
  const dotColor = full ? "#C9C7CF" : left <= 2 ? DC.accent : DC.green;
  const spotsText = full ? dict.common.full : `${left} ${dict.common.spotsLeft}`;
  const isKids = s.class_type.audience === "child";

  return (
    <div
      className={isKids ? "dc-kids" : undefined}
      style={{
        border: isKids ? "1.5px solid #FF5C8A" : `1px solid ${DC.border2}`,
        borderRadius: 16,
        padding: "18px 18px 16px",
      }}
    >
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
      ) : loggedIn ? (
        <Link
          href={`/${lang}/book/${s.id}`}
          style={{ ...btnBase, background: DC.accent, color: "#fff" }}
        >
          {dict.schedule.bookCta}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => onReserve(s)}
          style={{ ...btnBase, background: DC.accent, color: "#fff", cursor: "pointer" }}
        >
          {dict.schedule.bookCta}
        </button>
      )}
    </div>
  );
}
