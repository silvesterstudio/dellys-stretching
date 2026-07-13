import { createClient } from "@/lib/supabase/server";

export interface MyBooking {
  id: string;
  status: string;
  child_name: string | null;
  // True for a no-login reservation later linked to this account — it lives in
  // guest_bookings, not bookings, so it can't be cancelled from the dashboard.
  guest?: boolean;
  session: {
    id: string;
    starts_at: string;
    status: string;
    class_type: {
      name_ro: string;
      name_ru: string;
      color: string;
      audience: "adult" | "child";
    } | null;
  } | null;
}

export interface MyMembership {
  id: string;
  sessions_remaining: number;
  expires_at: string;
  frozen: boolean;
  plan: { name_ro: string; name_ru: string; session_count: number } | null;
}

function one<T>(v: T | T[] | null): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function fetchMyBookings(): Promise<MyBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("bookings")
    .select(
      `id, status, child_id,
       session:sessions ( id, starts_at, status,
         class_type:class_types ( name_ro, name_ru, color, audience ) ),
       child:children ( name )`,
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => {
    const sRaw = one(r.session);
    const session: MyBooking["session"] = sRaw
      ? {
          id: sRaw.id,
          starts_at: sRaw.starts_at,
          status: sRaw.status,
          class_type: one(sRaw.class_type),
        }
      : null;
    const child = one(r.child);
    return {
      id: r.id as string,
      status: r.status as string,
      child_name: child?.name ?? null,
      session,
    };
  });
}

// No-login reservations that were linked to this account (by phone or via the
// front-desk convert). Shown as read-only upcoming/past entries in the dashboard.
export async function fetchMyGuestBookings(): Promise<MyBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("guest_bookings")
    .select(
      `id, status, child_name, starts_at, class_name,
       session:sessions ( id, starts_at, status,
         class_type:class_types ( name_ro, name_ru, color, audience ) )`,
    )
    .neq("status", "cancelled")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data as any[]).map((r) => {
    const sRaw = one(r.session);
    // Fall back to the booking's snapshot if the live session was deleted.
    const session: MyBooking["session"] = sRaw
      ? { id: sRaw.id, starts_at: sRaw.starts_at, status: sRaw.status, class_type: one(sRaw.class_type) }
      : r.starts_at
        ? {
            id: "",
            starts_at: r.starts_at,
            status: "scheduled",
            class_type: r.class_name
              ? { name_ro: r.class_name, name_ru: r.class_name, color: "#cbc4ca", audience: "adult" }
              : null,
          }
        : null;
    return {
      id: r.id as string,
      status: "booked",
      guest: true,
      child_name: (r.child_name as string) ?? null,
      session,
    };
  });
}

export async function fetchMyMemberships(): Promise<MyMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_memberships")
    .select(
      `id, sessions_remaining, expires_at, frozen,
       plan:membership_plans ( name_ro, name_ru, session_count )`,
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    sessions_remaining: r.sessions_remaining as number,
    expires_at: r.expires_at as string,
    frozen: !!r.frozen,
    plan: one(r.plan as never) as MyMembership["plan"],
  }));
}

export interface MyRequest {
  id: string;
  created_at: string;
  plan: { name_ro: string; name_ru: string } | null;
}

export async function fetchMyRequests(): Promise<MyRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("membership_requests")
    .select(`id, created_at, plan:membership_plans ( name_ro, name_ru )`)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    created_at: r.created_at as string,
    plan: one(r.plan as never) as MyRequest["plan"],
  }));
}

export async function fetchMyChildren(): Promise<{ id: string; name: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("children")
    .select("id, name")
    .order("created_at", { ascending: true });
  return data ?? [];
}
