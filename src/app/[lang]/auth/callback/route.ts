import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isLocale } from "@/i18n/config";

// Completes a magic-link sign-in, then redirects to ?next (the booking the
// user came for, or their dashboard). Three arrival shapes:
//  - #access_token fragment (the live flow) → invisible to the server, so we
//    forward to /auth/confirm which stores the session client-side. Implicit
//    links work in ANY browser — Gmail/Instagram in-app browsers included.
//  - ?token_hash&type → verifyOtp, in case the Supabase email template is ever
//    switched to `{{ .TokenHash }}` links.
//  - ?code → PKCE exchange (legacy links sent before the implicit switch).
//    Only works in the browser that requested the link — its code_verifier
//    cookie is needed — which is why in-app-browser users used to get
//    "link invalid or expired".
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ lang: string }> },
) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "ro";
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const otpType = searchParams.get("type") as EmailOtpType | null;
  // Only allow same-origin in-app paths as the post-login target (no open
  // redirect): must start with a single "/" and not "//".
  const rawNext = searchParams.get("next");
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : `/${locale}/dashboard`;

  // First-ever sign-in ⇒ a freshly created account. Flag it so the client
  // can fire the Meta "CompleteRegistration" conversion once on arrival.
  const successUrl = (user: User | null | undefined) => {
    const createdMs = user?.created_at ? new Date(user.created_at).getTime() : 0;
    const isNew = createdMs > 0 && Date.now() - createdMs < 5 * 60 * 1000;
    const sep = next.includes("?") ? "&" : "?";
    return `${origin}${isNew ? `${next}${sep}welcome=1` : next}`;
  };

  if ((tokenHash || code) && isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      if (tokenHash && otpType) {
        const { data, error } = await supabase.auth.verifyOtp({
          type: otpType,
          token_hash: tokenHash,
        });
        if (!error) return NextResponse.redirect(successUrl(data?.user));
      } else if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) return NextResponse.redirect(successUrl(data?.user));
      }
    } catch {
      // fall through to the error redirect below
    }
  } else if (!searchParams.get("error")) {
    // No server-readable auth params: an implicit-flow link landed here with
    // the session tokens in the URL #fragment, which never reaches the server.
    // Browsers carry the fragment across this redirect, and the confirm page's
    // Supabase client picks it up (or shows the login error if there's none).
    const url = new URL(`${origin}/${locale}/auth/confirm`);
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  return NextResponse.redirect(`${origin}/${locale}/login?error=link`);
}
