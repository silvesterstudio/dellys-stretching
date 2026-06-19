import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Returns the current user's profile (or null if signed out). Use in Server
// Components / Server Actions to gate UI and authorize admin actions.
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data ?? null;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "admin") {
    throw new Error("Forbidden: admin only");
  }
  return profile;
}
