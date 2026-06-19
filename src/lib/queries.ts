import { createClient } from "@/lib/supabase/server";

export interface SessionWithType {
  id: string;
  starts_at: string;
  duration_min: number;
  capacity: number;
  booked_count: number;
  instructor: string | null;
  status: string;
  class_type: {
    id: string;
    key: string;
    audience: "adult" | "child";
    name_ro: string;
    name_ru: string;
    color: string;
  };
}

// Fetches a single session (any status) joined with its class type.
export async function fetchSessionById(
  id: string,
): Promise<SessionWithType | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(
      `id, starts_at, duration_min, capacity, booked_count, instructor, status,
       class_type:class_types!inner ( id, key, audience, name_ro, name_ru, color )`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  return {
    ...(row as object),
    class_type: Array.isArray(row.class_type) ? row.class_type[0] : row.class_type,
  } as SessionWithType;
}

// Fetches scheduled sessions in [start, end) joined with their class type.
export async function fetchSessions(
  start: Date,
  end: Date,
): Promise<SessionWithType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select(
      `id, starts_at, duration_min, capacity, booked_count, instructor, status,
       class_type:class_types!inner ( id, key, audience, name_ro, name_ru, color )`,
    )
    .eq("status", "scheduled")
    .gte("starts_at", start.toISOString())
    .lt("starts_at", end.toISOString())
    .order("starts_at", { ascending: true });

  if (error) {
    console.error("fetchSessions:", error.message);
    return [];
  }
  // Supabase types the embedded relation as an array; normalize to object.
  return (data ?? []).map((row: Record<string, unknown>) => ({
    ...(row as object),
    class_type: Array.isArray(row.class_type) ? row.class_type[0] : row.class_type,
  })) as SessionWithType[];
}
