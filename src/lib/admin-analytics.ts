import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { TIMEZONE } from "@/lib/constants";
import { bucharestWallToUtc } from "@/lib/week";

// Admin analytics. Reads use the service-role client (RLS-bypassing) and are
// ONLY ever reached from pages/actions that have already verified the caller is
// an admin. Every query is wrapped so a missing service key or Supabase blip
// degrades to zeros instead of crashing the admin dashboard.

export type RangePreset = "today" | "yesterday" | "7d" | "30d" | "365d" | "custom";

export interface RangeSpec {
  preset: RangePreset;
  // YYYY-MM-DD (Bucharest calendar days) — only used when preset === "custom".
  startDate?: string;
  endDate?: string;
}

export interface ResolvedRange {
  startISO: string; // inclusive
  endISO: string; // exclusive
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (inclusive day shown to the user)
}

// "YYYY-MM-DD" for an instant, evaluated in the studio timezone (en-CA → ISO date).
function bucharestDateStr(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Calendar-day arithmetic on a YYYY-MM-DD string (DST-independent).
function addDaysStr(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(
    dt.getUTCDate(),
  ).padStart(2, "0")}`;
}

// Turn a preset (or custom dates) into a concrete [startISO, endISO) window,
// with day boundaries pinned to Bucharest midnight.
export function resolveRange(spec: RangeSpec, now: Date = new Date()): ResolvedRange {
  const today = bucharestDateStr(now);
  let startDate: string;
  let endDate: string; // inclusive

  switch (spec.preset) {
    case "today":
      startDate = today;
      endDate = today;
      break;
    case "yesterday":
      startDate = addDaysStr(today, -1);
      endDate = startDate;
      break;
    case "7d":
      startDate = addDaysStr(today, -6);
      endDate = today;
      break;
    case "30d":
      startDate = addDaysStr(today, -29);
      endDate = today;
      break;
    case "365d":
      startDate = addDaysStr(today, -364);
      endDate = today;
      break;
    case "custom":
    default:
      startDate = spec.startDate || today;
      endDate = spec.endDate || startDate;
      if (endDate < startDate) [startDate, endDate] = [endDate, startDate];
      break;
  }

  const endExclusive = addDaysStr(endDate, 1);
  return {
    startDate,
    endDate,
    startISO: bucharestWallToUtc(startDate, "00:00").toISOString(),
    endISO: bucharestWallToUtc(endExclusive, "00:00").toISOString(),
  };
}

export interface WindowMetrics {
  revenue: number; // sum of sold membership prices in window
  currency: string;
  membershipsSold: number;
  sessionsHeld: number;
  attendance: number; // attended bookings, by session date
  newMembers: number;
  bookings: number; // reservations made (excl. cancelled)
}

const EMPTY_WINDOW: WindowMetrics = {
  revenue: 0,
  currency: "MDL",
  membershipsSold: 0,
  sessionsHeld: 0,
  attendance: 0,
  newMembers: 0,
  bookings: 0,
};

function one<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

// Metrics for a single [startISO, endISO) window. Revenue is derived from the
// membership plans sold in the window (there is no separate payments table).
export async function computeWindowMetrics(
  startISO: string,
  endISO: string,
): Promise<WindowMetrics> {
  try {
    const admin = createAdminClient();
    const [sold, sessionsHeld, attendance, newMembers, bookings] = await Promise.all([
      admin
        .from("user_memberships")
        .select("plan:membership_plans ( price, currency )")
        .gte("created_at", startISO)
        .lt("created_at", endISO),
      admin
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled")
        .gte("starts_at", startISO)
        .lt("starts_at", endISO),
      admin
        .from("bookings")
        .select("id, sessions!inner ( starts_at )", { count: "exact", head: true })
        .eq("status", "attended")
        .gte("sessions.starts_at", startISO)
        .lt("sessions.starts_at", endISO),
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "client")
        .gte("created_at", startISO)
        .lt("created_at", endISO),
      admin
        .from("bookings")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled")
        .gte("created_at", startISO)
        .lt("created_at", endISO),
    ]);

    const soldRows = (sold.data ?? []) as Record<string, unknown>[];
    let revenue = 0;
    let currency = "MDL";
    for (const r of soldRows) {
      const plan = one(r.plan as never) as { price: number; currency: string } | null;
      if (plan) {
        revenue += Number(plan.price) || 0;
        if (plan.currency) currency = plan.currency;
      }
    }

    return {
      revenue,
      currency,
      membershipsSold: soldRows.length,
      sessionsHeld: sessionsHeld.count ?? 0,
      attendance: attendance.count ?? 0,
      newMembers: newMembers.count ?? 0,
      bookings: bookings.count ?? 0,
    };
  } catch {
    return EMPTY_WINDOW;
  }
}

export interface KpiMetrics {
  activeMemberships: number; // not expired & sessions remaining
  totalMembers: number;
  outstandingSessions: number; // sum of remaining sessions across active memberships
  todaySessions: number;
}

const EMPTY_KPI: KpiMetrics = {
  activeMemberships: 0,
  totalMembers: 0,
  outstandingSessions: 0,
  todaySessions: 0,
};

// Always-current snapshot KPIs (independent of the selected window).
export async function computeKpis(now: Date = new Date()): Promise<KpiMetrics> {
  try {
    const admin = createAdminClient();
    const nowISO = now.toISOString();
    const today = bucharestDateStr(now);
    const todayStart = bucharestWallToUtc(today, "00:00").toISOString();
    const tomorrowStart = bucharestWallToUtc(addDaysStr(today, 1), "00:00").toISOString();

    const [active, totalMembers, todaySessions] = await Promise.all([
      admin
        .from("user_memberships")
        .select("sessions_remaining")
        .eq("frozen", false)
        .gt("sessions_remaining", 0)
        .gt("expires_at", nowISO),
      admin.from("profiles").select("id", { count: "exact", head: true }).eq("role", "client"),
      admin
        .from("sessions")
        .select("id", { count: "exact", head: true })
        .neq("status", "cancelled")
        .gte("starts_at", todayStart)
        .lt("starts_at", tomorrowStart),
    ]);

    const activeRows = (active.data ?? []) as { sessions_remaining: number }[];
    return {
      activeMemberships: activeRows.length,
      outstandingSessions: activeRows.reduce((s, r) => s + (r.sessions_remaining || 0), 0),
      totalMembers: totalMembers.count ?? 0,
      todaySessions: todaySessions.count ?? 0,
    };
  } catch {
    return EMPTY_KPI;
  }
}
