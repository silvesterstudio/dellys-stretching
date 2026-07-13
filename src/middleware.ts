import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/constants";
import { isSupabaseConfigured, AUTH_COOKIE_OPTIONS } from "@/lib/supabase/config";

function hasLocalePrefix(pathname: string): boolean {
  return LOCALES.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
}

function preferredLocale(req: NextRequest): string {
  const cookie = req.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && (LOCALES as readonly string[]).includes(cookie)) return cookie;
  const accept = req.headers.get("accept-language")?.toLowerCase() ?? "";
  if (accept.startsWith("ru") || accept.includes(",ru")) return "ru";
  return DEFAULT_LOCALE;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Locale routing — ensure every path is prefixed with a supported locale.
  if (!hasLocalePrefix(pathname)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`;
    return NextResponse.redirect(url);
  }

  // 2. Refresh the Supabase auth session and propagate cookies.
  let response = NextResponse.next({ request: req });

  // Skip the auth round-trip entirely when Supabase isn't configured, so a
  // missing/placeholder host can't make every request hang.
  if (!isSupabaseConfigured()) {
    return response;
  }

  // Perf: anonymous visitors (most ad-landing traffic) carry no Supabase auth
  // cookie, so there's nothing to refresh — skip the network round-trip and
  // serve them without ever touching Supabase.
  const hasAuthCookie = req.cookies
    .getAll()
    .some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  if (!hasAuthCookie) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            req.cookies.set(name, value),
          );
          response = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Touch the session so it refreshes if needed. Guarded: a Supabase outage
  // must not turn every request into a 500 — just serve the request as-is.
  try {
    await supabase.auth.getUser();
  } catch {
    // ignore — degrade to the unrefreshed session
  }

  return response;
}

export const config = {
  // Run on everything except static assets and Next internals.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
