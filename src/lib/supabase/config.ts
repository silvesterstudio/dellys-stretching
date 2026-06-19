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
