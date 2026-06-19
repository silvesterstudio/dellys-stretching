import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database } from "@/lib/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Returns the current user's profile (or null if signed out). Use in Server
// Components / Server Actions to gate UI and authorize admin actions.
export async function getCurrentProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();

  // Fast path: read the session from cookies (no network). Anonymous visitors —
  // most ad-landing traffic — bail out here without a single Supabase round-trip.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  return data ?? null;
}

// Securely resolve the current admin: validates the JWT over the network
// (getUser), not just the cookie. Use for authorization (admin pages/actions).
export async function requireAdmin(): Promise<Profile> {
  if (!isSupabaseConfigured()) throw new Error("Forbidden");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Forbidden");
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!data || data.role !== "admin") throw new Error("Forbidden: admin only");
  return data;
}
