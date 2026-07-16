"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";
import { AUTH_COOKIE_OPTIONS } from "./config";

// Browser-side Supabase client. Uses the public anon key; all access is governed
// by RLS policies. Safe to use in client components.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Persist the auth cookies for a year so a logged-in visitor stays signed in
    // across browser restarts (otherwise they default to session cookies).
    // detectSessionInUrl is off: magic-link tokens arrive as an implicit-flow
    // #fragment, which this PKCE-locked client would reject with an error —
    // AuthConfirm consumes them explicitly via setSession() instead.
    { cookieOptions: AUTH_COOKIE_OPTIONS, auth: { detectSessionInUrl: false } },
  );
}
