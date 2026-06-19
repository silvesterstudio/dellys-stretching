"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/i18n-data";
import {
  createTemplateAction,
  toggleTemplateAction,
  deleteTemplateAction,
} from "@/app/[lang]/admin/actions";

type ClassType = {
  id: string;
  name_ro: string;
  name_ru: string;
  audience: "adult" | "child";
  default_capacity: number;
};
interface Template {
  id: string;
  weekday: number;
  start_time: string;
  duration_min: number;
  capacity: number;
  instructor: string | null;
  active: boolean;
  class_type: { name_ro: string; name_ru: string; color: string };
}

export function TemplatesManager({
  lang,
  dict,
  classTypes,
  templates,
}: {
  lang: Locale;
  dict: Dictionary;
  classTypes: ClassType[];
  templates: Template[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [classTypeId, setClassTypeId] = useState(classTypes[0]?.id ?? "");
  const [weekday, setWeekday] = useState(1);
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(11);
  const [instructor, setInstructor] = useState("");

  const weekdayNames = dict.weekdays as Record<string, string>;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!classTypeId) return;
    setBusy(true);
    setError(null);
    const { error } = await createTemplateAction({
      classTypeId,
      weekday,
      startTime: time,
      durationMin: duration,
      capacity,
      instructor: instructor.trim() || null,
    });
    setBusy(false);
    if (error) {
      setError(dict.common.error);
      return;
    }
    setInstructor("");
    router.refresh();
  }

  async function toggle(t: Template) {
    setBusy(true);
    await toggleTemplateAction(t.id, !t.active);
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(true);
    await deleteTemplateAction(id);
    setBusy(false);
    router.refresh();
  }

  const byDay = new Map<number, Template[]>();
  for (const t of templates) {
    const arr = byDay.get(t.weekday) ?? [];
    arr.push(t);
    byDay.set(t.weekday, arr);
  }
  // Display Mon..Sun (1..6, then 0).
  const dayOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="space-y-6">
      <form onSubmit={add} className="card grid gap-3 p-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <h2 className="text-lg font-semibold text-mauve-800">
            {dict.admin.createTemplate}
          </h2>
        </div>
        <div>
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
                {localized(c, "name", lang)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">{dict.admin.day}</label>
          <select
            className="input"
            value={weekday}
            onChange={(e) => setWeekday(Number(e.target.value))}
          >
            {dayOrder.map((d) => (
              <option key={d} value={d}>
                {weekdayNames[String(d)]}
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
        <div className="sm:col-span-3">
          {error && <div className="mb-2 text-sm text-red-600">{error}</div>}
          <button type="submit" disabled={busy} className="btn-primary">
            {dict.admin.add}
          </button>
        </div>
      </form>

      <div className="space-y-4">
        {dayOrder.map((d) => {
          const items = byDay.get(d) ?? [];
          if (items.length === 0) return null;
          return (
            <div key={d}>
              <h3 className="mb-2 font-semibold capitalize text-mauve-700">
                {weekdayNames[String(d)]}
              </h3>
              <div className="space-y-2">
                {items.map((t) => (
                  <div
                    key={t.id}
                    className={`card flex items-center justify-between gap-3 p-3 ${
                      t.active ? "" : "opacity-50"
                    }`}
                    style={{ borderLeft: `4px solid ${t.class_type.color}` }}
                  >
                    <div className="min-w-0 text-sm">
                      <span className="font-medium text-mauve-900">
                        {t.start_time}
                      </span>{" "}
                      · {localized(t.class_type, "name", lang)} · {t.capacity}{" "}
                      {dict.common.spotsLeft}
                      {t.instructor && (
                        <span className="text-mauve-400"> · {t.instructor}</span>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => toggle(t)}
                        disabled={busy}
                        className="text-xs text-mauve-500 underline hover:text-mauve-800"
                      >
                        {t.active ? dict.admin.inactive : dict.admin.active}
                      </button>
                      <button
                        onClick={() => remove(t.id)}
                        disabled={busy}
                        className="text-xs text-red-500 underline hover:text-red-700"
                      >
                        {dict.admin.delete}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
