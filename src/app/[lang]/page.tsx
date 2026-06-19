import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getWeekRange } from "@/lib/week";
import { fetchSessions } from "@/lib/queries";
import { formatDateShort } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const days = range.days.map((d) => d.toISOString());
  const weekLabel = `${formatDateShort(range.days[0].toISOString(), locale)} – ${formatDateShort(
    range.days[6].toISOString(),
    locale,
  )}`;

  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-display text-3xl font-bold text-mauve-900">
          {dict.schedule.title}
        </h1>
        <p className="mt-1 text-mauve-500">{dict.schedule.subtitle}</p>
      </div>

      <div className="mb-5 flex items-center justify-center gap-3">
        {offset > 0 ? (
          <Link href={`/${locale}?week=${offset - 1}`} className="btn-secondary">
            ← {dict.schedule.prevWeek}
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none opacity-40">
            ← {dict.schedule.prevWeek}
          </span>
        )}
        <span className="min-w-40 text-center text-sm font-medium text-mauve-700">
          {dict.schedule.weekOf} {weekLabel}
        </span>
        <Link href={`/${locale}?week=${offset + 1}`} className="btn-secondary">
          {dict.schedule.nextWeek} →
        </Link>
      </div>

      <ScheduleGrid
        lang={locale}
        dict={dict}
        days={days}
        initialSessions={sessions}
        loggedIn={!!user}
      />
    </div>
  );
}
