import { createClient } from "@/lib/supabase/server";

export interface MyBooking {
  id: string;
  status: string;
  child_name: string | null;
  session: {
    id: string;
    starts_at: string;
    status: string;
    class_type: {
      name_ro: string;
      name_ru: string;
      color: string;
      audience: "adult" | "child";
    };
  } | null;
}

export interface MyMembership {
  id: string;
  sessions_remaining: number;
  expires_at: string;
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

export async function fetchMyMemberships(): Promise<MyMembership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_memberships")
    .select(
      `id, sessions_remaining, expires_at,
       plan:membership_plans ( name_ro, name_ru, session_count )`,
    )
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map((r: Record<string, unknown>) => ({
    id: r.id as string,
    sessions_remaining: r.sessions_remaining as number,
    expires_at: r.expires_at as string,
    plan: one(r.plan as never) as MyMembership["plan"],
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
