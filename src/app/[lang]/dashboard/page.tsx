import { redirect } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { CANCEL_WINDOW_HOURS } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  fetchMyBookings,
  fetchMyMemberships,
  fetchMyChildren,
  fetchMyRequests,
  type MyBooking,
} from "@/lib/dashboard-queries";
import { fetchAvailableTrials } from "@/lib/trial";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/i18n-data";
import { CancelButton } from "@/components/dashboard/CancelButton";
import { CancelRequestButton } from "@/components/dashboard/CancelRequestButton";
import { ProfileForm } from "@/components/dashboard/ProfileForm";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  booked: "bg-brand-50 text-brand-700",
  pending: "bg-amber-50 text-amber-700",
  attended: "bg-green-50 text-green-700",
  no_show: "bg-mauve-100 text-mauve-500",
  cancelled: "bg-mauve-100 text-mauve-400",
};

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  let supabase: Awaited<ReturnType<typeof createClient>> | null = null;
  let userId: string | null = null;
  if (isSupabaseConfigured()) {
    try {
      supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      userId = null;
    }
  }
  // redirect() throws internally — keep it outside the try/catch above.
  if (!userId || !supabase) redirect(`/${locale}/login`);

  const [
    bookings,
    memberships,
    children,
    requests,
    { data: profile },
    availableTrials,
  ] = await Promise.all([
    fetchMyBookings(),
    fetchMyMemberships(),
    fetchMyChildren(),
    fetchMyRequests(),
    supabase.from("profiles").select("full_name, phone").eq("id", userId).maybeSingle(),
    fetchAvailableTrials(supabase, userId),
  ]);

  const now = Date.now();
  const isUpcoming = (b: MyBooking) =>
    b.session &&
    b.session.status === "scheduled" &&
    new Date(b.session.starts_at).getTime() > now &&
    (b.status === "booked" || b.status === "pending");

  const upcoming = bookings
    .filter(isUpcoming)
    .sort(
      (a, b) =>
        new Date(a.session!.starts_at).getTime() -
        new Date(b.session!.starts_at).getTime(),
    );
  const past = bookings.filter((b) => !isUpcoming(b));

  const statusLabel = (s: string) =>
    s === "attended"
      ? dict.admin.attended
      : s === "no_show"
        ? dict.admin.noShow
        : s === "cancelled"
          ? dict.common.cancel
          : dict.common.booked;

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold text-mauve-900">
        {dict.dashboard.title}
      </h1>

      {/* Free introductory sessions — one per category, until first attended. */}
      {availableTrials.length > 0 && (
        <section>
          <h2 className="section-title mb-1">{dict.dashboard.freeTrials}</h2>
          <p className="mb-3 text-sm text-mauve-500">{dict.dashboard.freeTrialsHint}</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {availableTrials.map((c) => (
              <div
                key={c}
                className="card flex items-center gap-3 border-green-200 p-4"
              >
                <span className="badge-success shrink-0">
                  {dict.dashboard.freeTrialBadge}
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-mauve-900">
                    {dict.trial.categories[c]}
                  </div>
                  <div className="text-xs text-mauve-400">
                    {dict.dashboard.freeTrialOne}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Link href={`/${locale}`} className="btn-primary mt-3">
            {dict.schedule.bookCta}
          </Link>
        </section>
      )}

      {/* Memberships */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-mauve-800">
          {dict.dashboard.myMemberships}
        </h2>
        {memberships.length === 0 ? (
          <div className="card p-5 text-sm text-mauve-500">
            {dict.dashboard.noMemberships}{" "}
            <Link href={`/${locale}/memberships`} className="text-brand-600 underline">
              {dict.nav.memberships}
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {memberships.map((m) => {
              const expired = new Date(m.expires_at).getTime() <= now;
              const usable = !expired && m.sessions_remaining > 0 && !m.frozen;
              return (
                <div key={m.id} className="card p-4">
                  <div className="font-medium text-mauve-900">
                    {m.plan ? localized(m.plan, "name", locale) : "—"}
                  </div>
                  <div
                    className={`mt-1 text-2xl font-bold ${usable ? "text-brand-600" : "text-mauve-300"}`}
                  >
                    {m.sessions_remaining}
                    <span className="ml-1 text-xs font-normal text-mauve-400">
                      {dict.dashboard.sessionsRemaining}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-mauve-400">
                    {m.frozen ? (
                      <span className="text-mauve-500">{dict.admin.member.frozen}</span>
                    ) : expired ? (
                      <span className="text-red-500">{dict.dashboard.expired}</span>
                    ) : m.sessions_remaining <= 0 ? (
                      <span className="text-red-500">{dict.dashboard.depleted}</span>
                    ) : (
                      <>
                        {dict.dashboard.expiresOn} {formatDate(m.expires_at, locale)}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Pending membership requests */}
      {requests.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-mauve-800">
            {dict.dashboard.pendingRequests}
          </h2>
          <div className="space-y-2">
            {requests.map((r) => (
              <div
                key={r.id}
                className="card flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="font-medium text-mauve-900">
                    {r.plan ? localized(r.plan, "name", locale) : "—"}
                  </div>
                  <div className="text-xs text-mauve-400">
                    {dict.dashboard.requestPendingNote}
                  </div>
                </div>
                <CancelRequestButton
                  requestId={r.id}
                  label={dict.dashboard.cancelRequest}
                  dict={dict}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming bookings */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-mauve-800">
          {dict.dashboard.upcoming}
        </h2>
        {upcoming.length === 0 ? (
          <div className="card p-5 text-sm text-mauve-500">
            {dict.dashboard.noBookings}{" "}
            <Link href={`/${locale}`} className="text-brand-600 underline">
              {dict.nav.schedule}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => {
              const start = new Date(b.session!.starts_at).getTime();
              const withinWindow = start - now < CANCEL_WINDOW_HOURS * 3600000;
              return (
                <div
                  key={b.id}
                  className="card flex items-center justify-between gap-3 p-4"
                  style={{ borderLeft: `4px solid ${b.session!.class_type?.color ?? "#cbc4ca"}` }}
                >
                  <div className="min-w-0">
                    <div className="font-medium text-mauve-900">
                      {b.session!.class_type
                        ? localized(b.session!.class_type, "name", locale)
                        : "—"}
                      {b.child_name && (
                        <span className="ml-2 text-xs text-mauve-400">
                          · {b.child_name}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-mauve-500">
                      {formatDate(b.session!.starts_at, locale)} ·{" "}
                      {formatTime(b.session!.starts_at, locale)}
                    </div>
                  </div>
                  <CancelButton
                    bookingId={b.id}
                    dict={dict}
                    withinWindow={withinWindow}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* History */}
      {past.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-mauve-800">
            {dict.dashboard.past}
          </h2>
          <div className="space-y-2">
            {past.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/60 px-4 py-2.5 text-sm"
              >
                <div className="min-w-0 text-mauve-600">
                  {b.session?.class_type
                    ? localized(b.session.class_type, "name", locale)
                    : "—"}
                  {b.child_name && (
                    <span className="ml-2 text-xs text-mauve-400">· {b.child_name}</span>
                  )}
                  {b.session && (
                    <span className="ml-2 text-xs text-mauve-400">
                      {formatDate(b.session.starts_at, locale)}
                    </span>
                  )}
                </div>
                <span
                  className={`badge ${STATUS_COLORS[b.status] ?? "bg-mauve-100 text-mauve-500"}`}
                >
                  {statusLabel(b.status)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Children */}
      {children.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-mauve-800">
            {dict.dashboard.children}
          </h2>
          <div className="flex flex-wrap gap-2">
            {children.map((c) => (
              <span key={c.id} className="badge bg-mauve-100 text-mauve-700">
                {c.name}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Account details */}
      <section>
        <h2 className="mb-3 text-lg font-semibold text-mauve-800">
          {dict.dashboard.myDetails}
        </h2>
        <ProfileForm
          dict={dict}
          initialName={profile?.full_name ?? null}
          initialPhone={profile?.phone ?? null}
        />
      </section>
    </div>
  );
}
