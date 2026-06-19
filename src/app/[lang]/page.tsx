import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getWeekRange } from "@/lib/week";
import { fetchSessions } from "@/lib/queries";
import { formatDateShort } from "@/lib/format";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { lang } = await params;
  const { week } = await searchParams;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  // Clamp the week offset to a sane window (can't browse the past, ~12 weeks out).
  const raw = Number.parseInt(week ?? "0", 10);
  const offset = Number.isFinite(raw) ? Math.min(12, Math.max(0, raw)) : 0;

  const range = getWeekRange(offset);
  const sessions = await fetchSessions(range.start, range.end);

  const days = range.days.map((d) => d.toISOString());
  const weekLabel = `${formatDateShort(range.days[0].toISOString(), locale)} – ${formatDateShort(
    range.days[6].toISOString(),
    locale,
  )}`;

  return (
    <div className="space-y-7">
      <section className="text-center">
        <p className="eyebrow">{dict.brand} · Studio</p>
        <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-mauve-900 sm:text-5xl">
          {dict.schedule.title}
        </h1>
        <p className="mx-auto mt-3 max-w-md text-mauve-500">{dict.schedule.subtitle}</p>
      </section>

      <div className="sticky top-[68px] z-20 -mx-4 bg-sand-50/60 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-full sm:px-2">
        <div className="flex items-center justify-between gap-2 sm:justify-center sm:gap-4">
          {offset > 0 ? (
            <Link href={`/${locale}?week=${offset - 1}`} className="btn-secondary px-3" aria-label={dict.schedule.prevWeek}>
              ←
            </Link>
          ) : (
            <span className="btn-secondary pointer-events-none px-3 opacity-30">←</span>
          )}
          <span className="text-center text-sm font-semibold text-mauve-700">
            {offset === 0 && (
              <span className="mr-1.5 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] text-brand-700">
                {dict.common.today}
              </span>
            )}
            {weekLabel}
          </span>
          <Link href={`/${locale}?week=${offset + 1}`} className="btn-secondary px-3" aria-label={dict.schedule.nextWeek}>
            →
          </Link>
        </div>
      </div>

      <ScheduleGrid
        lang={locale}
        dict={dict}
        days={days}
        initialSessions={sessions}
      />
    </div>
  );
}
