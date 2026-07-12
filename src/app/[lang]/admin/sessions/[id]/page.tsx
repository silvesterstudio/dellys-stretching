import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireStaff } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/i18n-data";
import { CheckInRow } from "@/components/admin/CheckInRow";
import { WalkInCheckIn } from "@/components/admin/WalkInCheckIn";
import { GuestLeadsPanel, type GuestLead } from "@/components/admin/GuestLeadsPanel";

export const dynamic = "force-dynamic";

interface MembershipOpt {
  id: string;
  user_id: string;
  label: string;
}

export default async function RosterPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);
  // Roster is reachable by reception staff (check-in), so gate on staff and read
  // with the service role (reception has no direct RLS read on these tables).
  try {
    await requireStaff();
  } catch {
    redirect(`/${locale}/staff`);
  }
  const supabase = createAdminClient();

  const { data: sessionRaw } = await supabase
    .from("sessions")
    .select(
      `id, starts_at, capacity, booked_count, status, instructor,
       class_type:class_types ( name_ro, name_ru, color, audience, category )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (!sessionRaw) notFound();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sRaw = sessionRaw as any;
  const session = {
    id: sRaw.id as string,
    starts_at: sRaw.starts_at as string,
    capacity: sRaw.capacity as number,
    booked_count: sRaw.booked_count as number,
    instructor: (sRaw.instructor as string) ?? null,
    class_type: (Array.isArray(sRaw.class_type)
      ? sRaw.class_type[0]
      : sRaw.class_type) as {
      name_ro: string;
      name_ru: string;
      color: string;
      audience: "adult" | "child";
      category: string;
    },
  };

  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select(
      `id, status, user_id, child_id,
       user:profiles ( email, full_name ),
       child:children ( name )`,
    )
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  // No-login guest reservations for this session (name + phone) — these hold a
  // seat but aren't real accounts, so they live in guest_bookings, not bookings.
  const { data: guestRaw } = await supabase
    .from("guest_bookings")
    .select("id, full_name, phone, class_name, starts_at, status, created_at")
    .eq("session_id", id)
    .neq("status", "cancelled")
    .order("created_at", { ascending: true });
  const guestLeads = (guestRaw ?? []) as GuestLead[];

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const bookings = (bookingsRaw ?? []).map((b: Record<string, unknown>) => {
    const u = one(b.user) as { email: string; full_name: string | null } | null;
    const c = one(b.child) as { name: string } | null;
    return {
      id: b.id as string,
      status: b.status as string,
      user_id: b.user_id as string,
      name: u?.full_name || u?.email || "—",
      child_name: c?.name ?? null,
    };
  });

  // Fetch usable memberships for everyone on the roster (for deduction).
  const userIds = [...new Set(bookings.map((b) => b.user_id))];
  let memOpts: MembershipOpt[] = [];
  if (userIds.length > 0) {
    const { data: mems } = await supabase
      .from("user_memberships")
      .select(
        `id, user_id, sessions_remaining, expires_at,
         plan:membership_plans!inner ( name_ro, name_ru, audience )`,
      )
      .eq("plan.audience", session.class_type.audience)
      .eq("frozen", false)
      .in("user_id", userIds)
      .gt("sessions_remaining", 0)
      .gt("expires_at", new Date().toISOString());
    memOpts = (mems ?? []).map((m: Record<string, unknown>) => {
      const plan = one(m.plan) as { name_ro: string; name_ru: string } | null;
      return {
        id: m.id as string,
        user_id: m.user_id as string,
        label: `${plan ? localized(plan, "name", locale) : "—"} · ${m.sessions_remaining}`,
      };
    });
  }

  // Which of these clients have already used THIS session's category trial.
  const usedTrial = new Set<string>();
  if (userIds.length > 0) {
    const { data: usage } = await supabase
      .from("free_trial_usage")
      .select("user_id")
      .eq("category", session.class_type.category)
      .in("user_id", userIds);
    for (const r of usage ?? []) usedTrial.add((r as { user_id: string }).user_id);
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/${locale}/admin/templates`}
        className="text-sm text-mauve-500 hover:text-mauve-800"
      >
        ← {dict.admin.templates}
      </Link>

      <div
        className="card p-5"
        style={{ borderLeft: `4px solid ${session.class_type.color}` }}
      >
        <div className="text-xl font-bold text-mauve-900">
          {localized(session.class_type, "name", locale)}
        </div>
        <div className="text-sm text-mauve-500">
          {formatDate(session.starts_at, locale)} · {formatTime(session.starts_at, locale)}
          {session.instructor && ` · ${session.instructor}`}
        </div>
        <div className="mt-1 text-sm text-mauve-400">
          {session.booked_count}/{session.capacity} {dict.admin.participants}
        </div>
      </div>

      <WalkInCheckIn
        sessionId={session.id}
        audience={session.class_type.audience}
        lang={locale}
        dict={dict}
      />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-mauve-800">
          {dict.admin.roster}
        </h2>
        {bookings.length === 0 && guestLeads.length === 0 ? (
          <div className="card p-5 text-sm text-mauve-500">{dict.admin.noResults}</div>
        ) : (
          <div className="space-y-2">
            {/* No-login guest reservations (name + phone) share the roster with
                real account bookings so staff see one complete participant list. */}
            <GuestLeadsPanel leads={guestLeads} lang={locale} dict={dict} bare showClassTime={false} />
            {bookings.map((b) => (
              <CheckInRow
                key={b.id}
                dict={dict}
                booking={b}
                memberships={memOpts.filter((m) => m.user_id === b.user_id)}
                freeTrialAvailable={!usedTrial.has(b.user_id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
