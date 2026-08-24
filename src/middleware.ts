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

  // 0. Two things deliberately live outside the localized site:
  //    * /api/*  — a redirect to /ro/api/... would drop the POST body, so every
  //                kiosk scan would fail.
  //    * /kiosk  — the front-door tablet has its own root layout (no header, no
  //                pixel) and picks its language from ?lang.
  //    Neither needs an auth-session refresh either, so return immediately.
  if (pathname.startsWith("/api/") || pathname === "/kiosk" || pathname.startsWith("/kiosk/")) {
    return NextResponse.next({ request: req });
  }

  // 1. Locale routing.
  //
  // The locale lives on disk as the [lang] segment but is kept OUT of the URL:
  // dellys.md/program, not dellys.md/ro/program. The language is a choice, not a
  // place — switching it must not send the visitor somewhere else.
  //
  //   /ro/<path>  -> 308 to /<path>. Romanian is the default, so its prefix is
  //                  pure noise; every link ever shared still resolves.
  //   /ru/<path>  -> served as-is. Russian keeps real, crawlable URLs so it stays
  //                  in search results — a cookie-only language is invisible to
  //                  Googlebot, which carries no cookies.
  //   /<path>     -> REWRITTEN (URL unchanged) to /<locale>/<path>, the locale
  //                  coming from the NEXT_LOCALE cookie, else Accept-Language,
  //                  else Romanian.
  //
  // Auth callbacks are exempt from the /ro redirect: magic links already sitting
  // in inboxes point at /ro/auth/..., and those carry tokens worth not bouncing.
  if (pathname === "/ro" || pathname.startsWith("/ro/")) {
    const rest = pathname.slice(3);
    if (!rest.startsWith("/auth")) {
      const url = req.nextUrl.clone();
      url.pathname = rest || "/";
      const moved = NextResponse.redirect(url, 308);
      moved.cookies.set("NEXT_LOCALE", "ro", { path: "/", maxAge: 31536000 });
      return moved;
    }
  }

  // The rewrite target, if any. Held as a value rather than returned here: the
  // session refresh below must still run, and it rebuilds the response.
  const rewriteTo = hasLocalePrefix(pathname)
    ? null
    : (() => {
        const url = req.nextUrl.clone();
        url.pathname = `/${preferredLocale(req)}${pathname === "/" ? "" : pathname}`;
        return url;
      })();

  const build = () =>
    rewriteTo
      ? NextResponse.rewrite(rewriteTo, { request: req })
      : NextResponse.next({ request: req });

  // 2. Refresh the Supabase auth session and propagate cookies.
  let response = build();

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
          response = build();
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
  //
  // The extension list must cover every asset type served from /public, not
  // just images: anything not listed here gets locale-redirected to
  // /ro/<file> and 404s. That is what happened to the QR scanner worker.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|js|mjs|css|map|json|txt|xml|webmanifest|woff|woff2|ttf|otf|mp4|webm)$).*)",
  ],
};
