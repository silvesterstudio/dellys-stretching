import { redirect } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchSessionById } from "@/lib/queries";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/i18n-data";
import { BookingForm } from "@/components/booking/BookingForm";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ lang: string; sessionId: string }>;
}) {
  const { lang, sessionId } = await params;
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
  // redirect() throws internally, so it must stay outside the try/catch above.
  if (!userId || !supabase) {
    redirect(`/${locale}/login?session=${sessionId}`);
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

  const isChild = session.class_type.audience === "child";
  let children: { id: string; name: string }[] = [];
  if (isChild) {
    const { data } = await supabase
      .from("children")
      .select("id, name")
      .order("created_at", { ascending: true });
    children = data ?? [];
  }

  // Sessions left across the user's active memberships *for this class's
  // audience* — an adult bundle must not appear to cover a child class.
  const { data: mems } = await supabase
    .from("user_memberships")
    .select("sessions_remaining, plan:membership_plans!inner ( audience )")
    .eq("plan.audience", session.class_type.audience)
    .eq("frozen", false)
    .gt("sessions_remaining", 0)
    .gt("expires_at", new Date().toISOString());
  const balance = (mems ?? []).reduce(
    (sum, m) => sum + ((m.sessions_remaining as number) ?? 0),
    0,
  );

  // Free trial: one free introductory session per category (adult / kids 3-7 /
  // kids 8-13). Available for this class only if the client has no usable
  // membership for its audience and hasn't yet used this category's trial. The
  // authoritative consumption happens at check-in.
  let freeSessionAvailable = false;
  if (balance === 0) {
    const { data: used } = await supabase
      .from("free_trial_usage")
      .select("category")
      .eq("user_id", userId)
      .eq("category", session.class_type.category)
      .maybeSingle();
    freeSessionAvailable = !used;
  }

  const name = localized(session.class_type, "name", locale);

  return (
    <div className="mx-auto max-w-md px-4 py-8">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold text-mauve-900">
          {dict.booking.confirmTitle}
        </h1>

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
          <div className="mt-1 text-xs text-mauve-400">
            {Math.max(0, session.capacity - session.booked_count)} {dict.common.spotsLeft}
          </div>
        </div>

        <BookingForm
          lang={locale}
          dict={dict}
          sessionId={session.id}
          isChild={isChild}
          initialChildren={children}
          balance={balance}
          freeSessionAvailable={freeSessionAvailable}
          sessionStartISO={session.starts_at}
          sessionDurationMin={session.duration_min}
          sessionName={name}
        />
      </div>
    </div>
  );
}
