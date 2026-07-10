import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Database } from "@/lib/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

// Returns the current user's profile (or null if signed out). Use in Server
// Components / Server Actions to gate UI and authorize admin actions.
export async function getCurrentProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;

  // Everything here is wrapped so a Supabase outage (paused project, network
  // blip, failed token refresh for a returning visitor) degrades to "logged
  // out" instead of throwing and crashing the whole layout on every page.
  try {
    const supabase = await createClient();

    // Fast path: read the session from cookies. Anonymous visitors — most
    // ad-landing traffic — bail out here without a single Supabase round-trip.
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
  } catch {
    return null;
  }
}

// Safe current-user lookup for pages that gate on auth. Returns the user id or
// null; never throws (a Supabase hiccup shouldn't crash the page — the caller
// redirects to login instead). Keep redirect() OUTSIDE any try/catch.
export async function getCurrentUserId(): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// Securely resolve the current admin: validates the JWT over the network
// (getUser), not just the cookie. Use for authorization (admin pages/actions).
export async function requireAdmin(): Promise<Profile> {
  if (!isSupabaseConfigured()) throw new Error("Forbidden");
  const supabase = await createClient();
  let user;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    throw new Error("Forbidden");
  }
  if (!user) throw new Error("Forbidden");
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!data || data.role !== "admin") throw new Error("Forbidden: admin only");
  return data;
}

// Like requireAdmin, but also allows the limited "reception" role (front-desk
// staff who can run check-in but not pricing/resets/deletes). Admins pass too.
export async function requireStaff(): Promise<Profile> {
  if (!isSupabaseConfigured()) throw new Error("Forbidden");
  const supabase = await createClient();
  let user;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch {
    throw new Error("Forbidden");
  }
  if (!user) throw new Error("Forbidden");
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!data || (data.role !== "admin" && data.role !== "reception")) {
    throw new Error("Forbidden: staff only");
  }
  return data;
}
