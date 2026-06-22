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
  const next = searchParams.get("next") || `/${locale}/dashboard`;

  if (code && isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      // fall through to the error redirect below
    }
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=link`);
}
