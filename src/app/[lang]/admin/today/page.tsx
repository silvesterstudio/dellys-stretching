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
import { GuestLeadsPanel, type GuestLead } from "@/components/admin/GuestLeadsPanel";
import { LocationBar } from "@/components/admin/LocationBar";
import {
  KioskPanel,
  type KioskDeviceInfo,
  type CheckinLogRow,
} from "@/components/admin/KioskPanel";
import { getAdminScope } from "@/lib/locations-server";
import { PageHead } from "@/components/admin/PageHead";

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
  let profile;
  try {
    profile = await requireStaff();
  } catch {
    redirect("/staff");
  }
  const t = dict.admin.today;
  // Front desk sees only its own studio's classes.
  const scope = await getAdminScope(profile);

  // The tablet's setup link is a bearer credential, so it is admin-only —
  // reception can run check-in but must not be able to provision a device.
  const isAdmin = profile.role === "admin";

  const { start, end } = todayRange();
  let sessions: Record<string, unknown>[] = [];
  let leads: GuestLead[] = [];
  let device: KioskDeviceInfo | null = null;
  let recent: CheckinLogRow[] = [];
  try {
    const admin = createAdminClient();
    let sessionQuery = admin
      .from("sessions")
      .select(
        `id, starts_at, duration_min, capacity, booked_count, status, instructor,
         class_type:class_types ( name_ro, name_ru, color, audience )`,
      )
      .gte("starts_at", start)
      .lt("starts_at", end);
    if (scope.activeId) sessionQuery = sessionQuery.eq("location_id", scope.activeId);
    const { data } = await sessionQuery.order("starts_at", { ascending: true });
    sessions = (data ?? []) as Record<string, unknown>[];

    // Open guest-booking leads (funnel captures) — newest first, still active.
    // A lead belongs to the studio whose class it was for; leads with no session
    // attached aren't tied to a gym, so they stay visible to everyone.
    const { data: leadRows } = await admin
      .from("guest_bookings")
      .select(
        "id, full_name, child_name, phone, class_name, starts_at, status, claimed_by, created_at, session:sessions ( location_id )",
      )
      .in("status", ["new", "contacted"])
      .order("created_at", { ascending: false })
      .limit(50);
    leads = ((leadRows ?? []) as Record<string, unknown>[])
      .filter((r) => {
        if (!scope.activeId) return true;
        const sess = one(r.session as never) as { location_id: string } | null;
        return !sess || sess.location_id === scope.activeId;
      })
      .map(({ session: _session, ...rest }) => rest) as unknown as GuestLead[];

    if (isAdmin && scope.activeId) {
      const { data: dev } = await admin
        .from("kiosk_devices")
        .select("label, token, last_seen_at")
        .eq("location_id", scope.activeId)
        .eq("active", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      device = dev
        ? {
            label: (dev.label as string) ?? null,
            token: dev.token as string,
            lastSeenAt: (dev.last_seen_at as string) ?? null,
          }
        : null;

      const { data: logs } = await admin
        .from("checkin_logs")
        .select(
          `id, created_at, result,
           profile:profiles ( full_name, email ),
           session:sessions ( class_type:class_types ( name_ro, name_ru ) )`,
        )
        .eq("location_id", scope.activeId)
        .gte("created_at", start)
        .order("created_at", { ascending: false })
        .limit(15);
      recent = ((logs ?? []) as Record<string, unknown>[]).map((r) => {
        const p = one(r.profile as never) as
          | { full_name: string | null; email: string }
          | null;
        const sess = one(r.session as never) as { class_type: unknown } | null;
        const ct = sess ? (one(sess.class_type as never) as { name_ro: string; name_ru: string } | null) : null;
        return {
          id: r.id as string,
          createdAt: r.created_at as string,
          result: r.result as string,
          member: p?.full_name || p?.email || null,
          className: ct ? localized(ct, "name", locale) : null,
        };
      });
    }
  } catch {
    // Missing service key / blip → render empty, not a 500.
  }

  const now = Date.now();
  const rows = sessions.map((s) => {
    const ct = one(s.class_type as never) as
      | { name_ro: string; name_ru: string; color: string; audience: string }
      | null;
    const startsAt = s.starts_at as string;
    const startMs = new Date(startsAt).getTime();
    const endMs = startMs + ((s.duration_min as number) || 60) * 60000;
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
      // Only "done" once the class has actually ended (start + duration), and
      // "in progress" while it is running.
      ended: endMs < now,
      ongoing: startMs <= now && endMs >= now,
    };
  });

  return (
    <div className="space-y-5">
      <PageHead title={dict.admin.headToday} subtitle={dict.admin.headTodaySub} />
      <div>
        <LocationBar
          locations={scope.locations}
          activeId={scope.activeId}
          canSwitch={scope.canSwitch}
          lang={locale}
          dict={dict}
        />
        <h2 className="font-display text-2xl font-semibold text-mauve-900">{t.title}</h2>
        <p className="mt-0.5 text-sm text-mauve-500">{t.subtitle}</p>
      </div>

      {isAdmin && (
        <KioskPanel device={device} recent={recent} lang={locale} dict={dict} />
      )}

      <GuestLeadsPanel leads={leads} lang={locale} dict={dict} />

      {rows.length === 0 ? (
        <div className="card p-8 text-center text-sm text-mauve-500">{t.none}</div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const full = r.booked >= r.capacity;
            return (
              <Link
                key={r.id}
                href={`/admin/sessions/${r.id}`}
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
                      {r.status === "cancelled" ? (
                        <span className="badge-muted ml-2">{dict.common.cancel}</span>
                      ) : r.ongoing ? (
                        <span className="badge-success ml-2">{t.ongoing}</span>
                      ) : r.ended ? (
                        <span className="badge-muted ml-2">{t.done}</span>
                      ) : null}
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
