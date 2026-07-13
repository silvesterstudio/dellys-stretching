import { redirect } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentUserId } from "@/lib/auth";
import { fetchSessionById } from "@/lib/queries";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/i18n-data";
import { GuestBookingForm } from "@/components/booking/GuestBookingForm";

export const dynamic = "force-dynamic";

// Public "first reservation" funnel — no login. Logged-in users are sent to the
// real booking flow (membership/free-trial aware) instead.
export default async function ReservePage({
  params,
}: {
  params: Promise<{ lang: string; sessionId: string }>;
}) {
  const { lang, sessionId } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  const userId = await getCurrentUserId();
  // redirect() throws internally — keep it outside any try/catch.
  if (userId) {
    redirect(`/${locale}/book/${sessionId}`);
  }

  const session = await fetchSessionById(sessionId);
  const notBookable =
    !session ||
    session.status !== "scheduled" ||
    new Date(session.starts_at).getTime() <= Date.now();

  if (notBookable) {
    return (
      <div className="mx-auto max-w-md px-4 py-10 text-center">
        <p className="text-mauve-600">{dict.booking.pastSession}</p>
        <Link href={`/${locale}`} className="btn-primary mt-4">
          {dict.common.back}
        </Link>
      </div>
    );
  }

  const name = localized(session.class_type, "name", locale);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold text-mauve-900">
          {dict.reserve.title}
        </h1>
        <p className="mt-1 text-sm text-mauve-500">{dict.reserve.subtitle}</p>

        <div
          className="mt-4 rounded-xl bg-sand-50 p-4"
          style={{ borderLeft: `4px solid ${session.class_type.color}` }}
        >
          <div className="text-lg font-semibold text-mauve-900">{name}</div>
          <div className="text-sm text-mauve-600">
            {formatDate(session.starts_at, locale)} · {formatTime(session.starts_at, locale)}
          </div>
          {session.instructor && (
            <div className="text-xs text-mauve-400">
              {dict.schedule.instructor}: {session.instructor}
            </div>
          )}
        </div>

        <GuestBookingForm
          lang={locale}
          dict={dict}
          sessionId={session.id}
          isChild={session.class_type.audience === "child"}
          loginHref={`/${locale}/login?session=${session.id}`}
        />
      </div>
    </div>
  );
}
