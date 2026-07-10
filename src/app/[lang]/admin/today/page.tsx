import Link from "next/link";
import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { TIMEZONE } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { bucharestWallToUtc } from "@/lib/week";
import { formatTime } from "@/lib/format";
import { localized } from "@/lib/i18n-data";

export const dynamic = "force-dynamic";

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

// Today's calendar day in the studio timezone -> [startUTC, endUTC).
function todayRange(): { start: string; end: string; label: string } {
  const now = new Date();
  const todayStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const next = new Date(`${todayStr}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const nextStr = next.toISOString().slice(0, 10);
  return {
    start: bucharestWallToUtc(todayStr, "00:00").toISOString(),
    end: bucharestWallToUtc(nextStr, "00:00").toISOString(),
    label: todayStr,
  };
}

export default async function TodayPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);
  try {
    await requireStaff();
  } catch {
    redirect(`/${locale}/staff`);
  }
  const t = dict.admin.today;

  const { start, end } = todayRange();
  let sessions: Record<string, unknown>[] = [];
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("sessions")
      .select(
        `id, starts_at, capacity, booked_count, status, instructor,
         class_type:class_types ( name_ro, name_ru, color, audience )`,
      )
      .gte("starts_at", start)
      .lt("starts_at", end)
      .order("starts_at", { ascending: true });
    sessions = (data ?? []) as Record<string, unknown>[];
  } catch {
    // Missing service key / blip → render empty, not a 500.
  }

  const now = Date.now();
  const rows = sessions.map((s) => {
    const ct = one(s.class_type as never) as
      | { name_ro: string; name_ru: string; color: string; audience: string }
      | null;
    const startsAt = s.starts_at as string;
    return {
      id: s.id as string,
      startsAt,
      capacity: s.capacity as number,
      booked: s.booked_count as number,
      instructor: (s.instructor as string) ?? null,
      status: s.status as string,
      color: ct?.color ?? "#cbc4ca",
      name: ct ? localized(ct, "name", locale) : "—",
      audience: ct?.audience ?? "adult",
      past: new Date(startsAt).getTime() < now,
    };
  });

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl font-semibold text-mauve-900">{t.title}</h2>
        <p className="mt-0.5 text-sm text-mauve-500">{t.subtitle}</p>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-mauve-500">{t.none}</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const full = r.booked >= r.capacity;
            return (
              <Link
                key={r.id}
                href={`/${locale}/admin/sessions/${r.id}`}
                className={`card card-hover flex items-center justify-between gap-4 p-4 ${
                  r.status === "cancelled" ? "opacity-50" : ""
                }`}
                style={{ borderLeft: `4px solid ${r.color}` }}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <div className="shrink-0 text-center">
                    <div className="font-display text-lg font-bold text-mauve-900">
                      {formatTime(r.startsAt, locale)}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-mauve-900">
                      {r.name}
                      <span className="ml-2 text-xs text-mauve-400">
                        {dict.audience[r.audience as "adult" | "child"]}
                      </span>
                      {r.status === "cancelled" && (
                        <span className="badge-muted ml-2">{dict.common.cancel}</span>
                      )}
                      {r.past && r.status !== "cancelled" && (
                        <span className="badge-muted ml-2">{t.done}</span>
                      )}
                    </div>
                    {r.instructor && (
                      <div className="truncate text-xs text-mauve-400">{r.instructor}</div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`font-semibold ${full ? "text-red-500" : "text-brand-600"}`}
                  >
                    {r.booked}/{r.capacity}
                  </div>
                  <div className="text-[11px] text-mauve-400">{t.checkIn} →</div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
