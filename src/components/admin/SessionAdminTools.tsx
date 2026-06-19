"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { localized } from "@/lib/i18n-data";
import {
  createSessionAction,
  generateSessionsAction,
} from "@/app/[lang]/admin/actions";
import { SESSION_GENERATION_WEEKS } from "@/lib/constants";

type ClassType = {
  id: string;
  name_ro: string;
  name_ru: string;
  audience: "adult" | "child";
  default_capacity: number;
};

export function SessionAdminTools({
  lang,
  dict,
  classTypes,
}: {
  lang: Locale;
  dict: Dictionary;
  classTypes: ClassType[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const [classTypeId, setClassTypeId] = useState(classTypes[0]?.id ?? "");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("18:00");
  const [duration, setDuration] = useState(60);
  const [capacity, setCapacity] = useState(11);
  const [instructor, setInstructor] = useState("");

  async function generate() {
    setBusy(true);
    setMsg(null);
    const { error } = await generateSessionsAction(SESSION_GENERATION_WEEKS);
    setBusy(false);
    setMsg(error ? dict.common.error : dict.admin.generated);
    router.refresh();
  }

  async function createSession(e: React.FormEvent) {
    e.preventDefault();
    if (!classTypeId || !date || !time) return;
    setBusy(true);
    setMsg(null);
    const { error } = await createSessionAction({
      classTypeId,
      date,
      time,
      durationMin: duration,
      capacity,
      instructor: instructor.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMsg(dict.common.error);
      return;
    }
    setOpen(false);
    setDate("");
    router.refresh();
  }

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={generate} disabled={busy} className="btn-primary">
          {dict.admin.generate}
        </button>
        <button onClick={() => setOpen((o) => !o)} className="btn-secondary">
          + {dict.admin.createSession}
        </button>
        {msg && <span className="text-sm text-mauve-600">{msg}</span>}
      </div>
      <p className="mt-2 text-xs text-mauve-400">{dict.admin.generateWeeks}</p>

      {open && (
        <form
          onSubmit={createSession}
          className="mt-4 grid gap-3 border-t border-mauve-100 pt-4 sm:grid-cols-2"
        >
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
            <label className="label">{dict.admin.date}</label>
            <input
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
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
          <div className="sm:col-span-2">
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
          <div className="sm:col-span-2">
            <button type="submit" disabled={busy} className="btn-primary w-full">
              {dict.admin.createSession}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
