import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isLocale } from "@/i18n/config";

// Completes a magic-link sign-in: exchanges the ?code for a session, then
// redirects to ?next (the booking the user came for, or their dashboard).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "ro";
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  // Only allow same-origin in-app paths as the post-login target (no open
  // redirect): must start with a single "/" and not "//".
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : `/${locale}/dashboard`;

  if (code && isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        // First-ever sign-in ⇒ a freshly created account. Flag it so the client
        // can fire the Meta "CompleteRegistration" conversion once on arrival.
        const u = data?.user;
        const createdMs = u?.created_at ? new Date(u.created_at).getTime() : 0;
        const isNew = createdMs > 0 && Date.now() - createdMs < 5 * 60 * 1000;
        const sep = next.includes("?") ? "&" : "?";
        const dest = isNew ? `${next}${sep}welcome=1` : next;
        return NextResponse.redirect(`${origin}${dest}`);
      }
    } catch {
      // fall through to the error redirect below
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=link`);
}
