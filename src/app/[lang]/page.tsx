import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getWeekRange } from "@/lib/week";
import { weekdayInTz } from "@/lib/format";
import { fetchSessions } from "@/lib/queries";
import { getCurrentUserId } from "@/lib/auth";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  // Monday–Saturday of the current week. On Sunday the current week's Mon–Sat is
  // entirely in the past, so roll forward to next week — the schedule should
  // always show bookable days, never a dead all-past grid.
  const onSunday = weekdayInTz(new Date().toISOString()) === 0;
  const range = getWeekRange(onSunday ? 1 : 0);
  const days = range.days.slice(0, 6).map((d) => d.toISOString()); // Mon..Sat
  const weekEnd = range.days[6]; // Sunday 00:00 — exclusive end so Sat is included, Sun isn't.
  const startISO = range.start.toISOString();
  const endISO = weekEnd.toISOString();
  const [sessions, userId] = await Promise.all([
    fetchSessions(range.start, weekEnd),
    getCurrentUserId(),
  ]);

  return (
    <div className="space-y-8">
      <section className="pt-1 text-center">
        <h1 className="font-display text-3xl font-medium tracking-tight text-mauve-900 sm:text-4xl">
          {dict.schedule.title}
        </h1>
        <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-brand-500" />
      </section>

      <ScheduleGrid
        lang={locale}
        dict={dict}
        days={days}
        initialSessions={sessions}
        weekStartISO={startISO}
        weekEndISO={endISO}
        loggedIn={!!userId}
      />
    </div>
  );
}
