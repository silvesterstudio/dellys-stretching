// Auth cookies live for a year so a signed-in visitor is remembered across
// browser restarts (Supabase would otherwise write short-lived session cookies).
// Supabase still rotates the tokens inside these cookies on its own schedule.
export const AUTH_COOKIE_OPTIONS = { maxAge: 60 * 60 * 24 * 365 } as const;

// True only when real Supabase credentials are present. Lets the app render
// (logged-out, empty data) instead of hanging on a dead/placeholder host.
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return (
    !!url &&
    !!key &&
    !url.includes("placeholder") &&
    !key.includes("placeholder")
  );
}
