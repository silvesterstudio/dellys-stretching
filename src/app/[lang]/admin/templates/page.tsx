import { redirect } from "next/navigation";
import { TIMEZONE, type Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getWeekRange } from "@/lib/week";
import { formatDateShort } from "@/lib/format";
import { WeeklyScheduleManager } from "@/components/admin/WeeklyScheduleManager";
import { ResetPanel } from "@/components/admin/ResetPanel";
import { LocationBar } from "@/components/admin/LocationBar";
import { getAdminScope } from "@/lib/locations-server";

export const dynamic = "force-dynamic";

export default async function TemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ w?: string }>;
}) {
  const { lang } = await params;
  const { w } = await searchParams;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);
  // Admin-only page (the layout now admits reception staff too).
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect(`/${locale}/admin/today`);
  }
  const supabase = await createClient();
  // The weekly editor writes the recurring template, so it must be unambiguous
  // about which studio's schedule is being edited.
  const scope = await getAdminScope(profile);

  // Week to edit (offset from the current week; negative = past, positive = future).
  const raw = Number.parseInt(w ?? "0", 10);
  const offset = Number.isFinite(raw) ? Math.max(-52, Math.min(52, raw)) : 0;
  const range = getWeekRange(offset);
  const startISO = range.start.toISOString();
  const endISO = range.end.toISOString();

  let sessionQuery = supabase
    .from("sessions")
    .select(
      `id, starts_at, duration_min, capacity, booked_count, instructor,
       class_type:class_types ( name_ro, name_ru, color )`,
    )
    .eq("status", "scheduled")
    .gte("starts_at", startISO)
    .lt("starts_at", endISO);
  if (scope.activeId) sessionQuery = sessionQuery.eq("location_id", scope.activeId);

  const [{ data: classTypes }, { data: sessionsRaw }] = await Promise.all([
    // Class types are shared: both studios teach from the same catalogue.
    supabase
      .from("class_types")
      .select("id, name_ro, name_ru, audience, default_capacity")
      .eq("active", true)
      .order("name_ro"),
    sessionQuery.order("starts_at", { ascending: true }),
  ]);

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const sessions = (sessionsRaw ?? []).map((s: Record<string, unknown>) => ({
    ...(s as object),
    class_type: one(s.class_type),
  }));

  const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(locale === "ru" ? "ru-RU" : "ro-RO", {
      ...opts,
      timeZone: TIMEZONE,
    }).format(new Date(iso));
  const dateStr = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));

  // All 7 days (admins manage Sunday too, unlike the public Mon–Sat view).
  const days = range.days.map((d) => {
    const iso = d.toISOString();
    return {
      iso,
      date: dateStr(iso),
      weekdayLabel: fmtDay(iso, { weekday: "long" }),
      dayMonth: fmtDay(iso, { day: "2-digit", month: "2-digit" }),
    };
  });

  const weekLabel = `${formatDateShort(range.days[0].toISOString(), locale)} – ${formatDateShort(
    range.days[6].toISOString(),
    locale,
  )}`;

  return (
    <div className="space-y-8">
      <LocationBar
        locations={scope.locations}
        activeId={scope.activeId}
        canSwitch={scope.canSwitch}
        lang={locale}
        dict={dict}
      />
      <WeeklyScheduleManager
        lang={locale}
        dict={dict}
        classTypes={(classTypes ?? []) as never}
        days={days}
        sessions={sessions as never}
        offset={offset}
        weekStartISO={startISO}
        weekEndISO={endISO}
        weekLabel={weekLabel}
        isCurrentWeek={offset === 0}
        locationId={scope.activeId}
      />
      {/* Resets wipe every studio at once, so only an unrestricted admin gets them. */}
      {profile.location_id === null && <ResetPanel kind="schedule" dict={dict} />}
    </div>
  );
}
