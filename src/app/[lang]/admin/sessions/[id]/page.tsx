import Link from "next/link";
import { notFound } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime } from "@/lib/format";
import { localized } from "@/lib/i18n-data";
import { CheckInRow } from "@/components/admin/CheckInRow";

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
  const supabase = await createClient();

  const { data: sessionRaw } = await supabase
    .from("sessions")
    .select(
      `id, starts_at, capacity, booked_count, status, instructor,
       class_type:class_types ( name_ro, name_ru, color, audience )`,
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
    },
  };

  const { data: bookingsRaw } = await supabase
    .from("bookings")
    .select(
      `id, status, user_id, child_id,
       user:profiles ( email, full_name, free_session_used ),
       child:children ( name )`,
    )
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  const one = (v: unknown) => (Array.isArray(v) ? v[0] : v);
  const bookings = (bookingsRaw ?? []).map((b: Record<string, unknown>) => {
    const u = one(b.user) as
      | { email: string; full_name: string | null; free_session_used: boolean }
      | null;
    const c = one(b.child) as { name: string } | null;
    return {
      id: b.id as string,
      status: b.status as string,
      user_id: b.user_id as string,
      name: u?.full_name || u?.email || "—",
      child_name: c?.name ?? null,
      // Free trial still available (no membership used yet for any session).
      freeTrialAvailable: u ? !u.free_session_used : false,
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

      <section>
        <h2 className="mb-3 text-lg font-semibold text-mauve-800">
          {dict.admin.roster}
        </h2>
        {bookings.length === 0 ? (
          <div className="card p-5 text-sm text-mauve-500">{dict.admin.noResults}</div>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <CheckInRow
                key={b.id}
                dict={dict}
                booking={b}
                memberships={memOpts.filter((m) => m.user_id === b.user_id)}
                freeTrialAvailable={b.freeTrialAvailable}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
