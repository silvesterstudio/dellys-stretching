"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SESSION_GENERATION_WEEKS, type Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/i18n-data";
import { formatTime } from "@/lib/format";
import { dayKey } from "@/lib/week";
import {
  createSessionAction,
  deleteSessionAction,
  generateSessionsAction,
  saveWeekAsTemplateAction,
} from "@/app/[lang]/admin/actions";

type ClassType = {
  id: string;
  name_ro: string;
  name_ru: string;
  audience: "adult" | "child";
  default_capacity: number;
};

type Session = {
  id: string;
  starts_at: string;
  duration_min: number;
  capacity: number;
  booked_count: number;
  instructor: string | null;
  class_type: { name_ro: string; name_ru: string; color: string };
};

type Day = { iso: string; date: string; weekdayLabel: string; dayMonth: string };

export function WeeklyScheduleManager({
  lang,
  dict,
  classTypes,
  days,
  sessions,
  offset,
  weekStartISO,
  weekEndISO,
  weekLabel,
  isCurrentWeek,
}: {
  lang: Locale;
  dict: Dictionary;
  classTypes: ClassType[];
  days: Day[];
  sessions: Session[];
  offset: number;
  weekStartISO: string;
  weekEndISO: string;
  weekLabel: string;
  isCurrentWeek: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const base = `/${lang}/admin/templates`;

  const byDay = new Map<string, Session[]>();
  for (const s of sessions) {
    const k = dayKey(s.starts_at);
    const arr = byDay.get(k) ?? [];
    arr.push(s);
    byDay.set(k, arr);
  }

  async function generate() {
    setBusy(true);
    setMsg(null);
    const { error } = await generateSessionsAction(SESSION_GENERATION_WEEKS);
    setBusy(false);
    setMsg(error ? dict.common.error : dict.admin.generated);
    router.refresh();
  }

  async function saveDefault() {
    if (!window.confirm(dict.admin.saveAsDefaultConfirm)) return;
    setBusy(true);
    setMsg(null);
    const { error } = await saveWeekAsTemplateAction(weekStartISO, weekEndISO);
    setBusy(false);
    setMsg(error ? dict.common.error : dict.admin.savedDefault);
    router.refresh();
  }

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Link href={`${base}?w=${offset - 1}`} className="btn-secondary px-3" aria-label={dict.schedule.prevWeek}>
            ←
          </Link>
          <span className="text-sm font-semibold text-mauve-800">
            {isCurrentWeek && (
              <span className="mr-1.5 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-700">
                {dict.common.today}
              </span>
            )}
            {weekLabel}
          </span>
          <Link href={`${base}?w=${offset + 1}`} className="btn-secondary px-3" aria-label={dict.schedule.nextWeek}>
            →
          </Link>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {msg && <span className="text-sm text-mauve-600">{msg}</span>}
          <button onClick={saveDefault} disabled={busy} className="btn-secondary text-sm">
            {dict.admin.saveAsDefault}
          </button>
          <button onClick={generate} disabled={busy} className="btn-primary text-sm">
            {dict.admin.generate}
          </button>
        </div>
      </div>
      <p className="-mt-3 text-xs text-mauve-400">{dict.admin.generateWeeks}</p>

      <div className="space-y-5">
        {days.map((d) => (
          <DayEditor
            key={d.iso}
            day={d}
            sessions={byDay.get(dayKey(d.iso)) ?? []}
            classTypes={classTypes}
            lang={lang}
            dict={dict}
          />
        ))}
      </div>
    </div>
  );
}

function DayEditor({
  day,
  sessions,
  classTypes,
  lang,
  dict,
}: {
  day: Day;
  sessions: Session[];
  classTypes: ClassType[];
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [classTypeId, setClassTypeId] = useState(classTypes[0]?.id ?? "");
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(classTypes[0]?.default_capacity ?? 11);
  const [instructor, setInstructor] = useState("");

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!classTypeId) return;
    setBusy(true);
    const { error } = await createSessionAction({
      classTypeId,
      date: day.date,
      time,
      durationMin: duration,
      capacity,
      instructor: instructor.trim() || null,
    });
    setBusy(false);
    if (!error) {
      setOpen(false);
      setInstructor("");
      router.refresh();
    }
  }

  async function remove(id: string) {
    if (!window.confirm(dict.admin.deleteSessionConfirm)) return;
    setBusy(true);
    await deleteSessionAction(id);
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between border-b border-mauve-100 pb-1.5">
        <h3 className="font-semibold capitalize text-mauve-800">
          {day.weekdayLabel}{" "}
          <span className="text-xs font-normal text-mauve-400">{day.dayMonth}</span>
        </h3>
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-medium text-brand-600 hover:text-brand-700"
        >
          + {dict.admin.createSession}
        </button>
      </div>

      <div className="space-y-2">
        {sessions.length === 0 && !open && (
          <p className="text-xs text-mauve-400">{dict.schedule.noSessionsDay}</p>
        )}

        {sessions.map((s) => (
          <div
            key={s.id}
            className="card flex items-center justify-between gap-3 p-3"
            style={{ borderLeft: `4px solid ${s.class_type.color}` }}
          >
            <div className="min-w-0 text-sm">
              <span className="font-semibold text-mauve-900">{formatTime(s.starts_at, lang)}</span>{" "}
              · {localized(s.class_type, "name", lang)}
              <span className="text-mauve-400">
                {" "}
                · {s.booked_count}/{s.capacity}
                {s.instructor ? ` · ${s.instructor}` : ""}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <Link
                href={`/${lang}/admin/sessions/${s.id}`}
                className="text-xs text-mauve-500 underline hover:text-mauve-800"
              >
                {dict.admin.checkIn}
              </Link>
              <button
                onClick={() => remove(s.id)}
                disabled={busy}
                className="text-xs text-red-500 underline hover:text-red-700"
              >
                {dict.admin.delete}
              </button>
            </div>
          </div>
        ))}

        {open && (
          <form onSubmit={add} className="card grid gap-3 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label">{dict.admin.classType}</label>
              <select
                className="input"
                value={classTypeId}
                onChange={(e) => {
                  setClassTypeId(e.target.value);
                  const ct = classTypes.find((c) => c.id === e.target.value);
                  if (ct) setCapacity(ct.default_capacity);
                }}
              >
                {classTypes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {localized(c, "name", lang)} ({dict.audience[c.audience]})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">{dict.admin.time}</label>
              <input
                type="time"
                className="input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">{dict.admin.duration}</label>
              <input
                type="number"
                min={15}
                step={5}
                className="input"
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">{dict.admin.capacity}</label>
              <input
                type="number"
                min={1}
                className="input"
                value={capacity}
                onChange={(e) => setCapacity(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">
                {dict.admin.instructor}{" "}
                <span className="text-mauve-400">({dict.admin.optional})</span>
              </label>
              <input
                className="input"
                value={instructor}
                onChange={(e) => setInstructor(e.target.value)}
              />
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <button type="submit" disabled={busy} className="btn-primary">
                {dict.admin.createSession}
              </button>
              <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
                {dict.common.cancel}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
