import { NextResponse, type NextRequest } from "next/server";
import { normalizeKioskToken } from "@/lib/kiosk-token";

const classSections = new Set([
  "admin", "book", "confidentialitate", "dashboard", "login", "memberships",
  "landing", "program", "register", "reserve", "staff", "welcome",
]);

const sharedPaths = new Set([
  "/admin", "/admin/check-in", "/cont", "/check-in", "/auth/callback", "/auth/confirm", "/reset-password",
  "/api/auth/setup", "/api/me", "/api/dashboard", "/api/kiosk/version", "/api/kiosk/device", "/api/scan",
]);

const checkInPaths = new Set(["/check-in", "/check-in?service=group", "/check-in?service=gym"]);

function redirectWithinDellys(request: NextRequest, path: string, query: URLSearchParams) {
  const target = request.nextUrl.clone();
  target.pathname = path;
  target.search = query.toString();
  return NextResponse.redirect(target, {
    status: 307,
    headers: { "Cache-Control": "no-store" },
  });
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  // Pass authenticated requests and form submissions to the upstream class app.
  if (pathname === "/classes" || pathname.startsWith("/classes/") || sharedPaths.has(pathname) ||
      (pathname === "/login" && checkInPaths.has(searchParams.get("next") ?? ""))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) {
    return NextResponse.json({
      error: "Please reload Dellys to use the current class system",
      url: "/classes",
    }, { status: 410 });
  }

  const segments = pathname.split("/").filter(Boolean);
  const prefix = segments[0] === "ro" || segments[0] === "ru" ? segments.shift() : null;
  const query = new URLSearchParams();
  if (segments[0] === "kiosk") {
    // Staying on Dellys keeps the device token already saved by the tablet.
    const token = normalizeKioskToken(searchParams.get("token") ?? "");
    if (/^[a-f0-9]{32}$/.test(token)) query.set("token", token);
    if (prefix === "ru" || searchParams.get("lang") === "ru") query.set("lang", "ru");
    return redirectWithinDellys(request, "/classes/kiosk", query);
  }

  const locale = prefix || request.cookies.get("classes-locale")?.value || request.cookies.get("NEXT_LOCALE")?.value;
  let target = locale === "ro" || locale === "ru" ? `/classes/${locale}` : "/classes";
  if (segments[0] === "auth") {
    target += "/login";
  } else if (classSections.has(segments[0])) {
    target += "/" + segments.join("/");
  }
  for (const key of ["loc", "session"]) {
    const value = searchParams.get(key);
    if (value && /^[a-z0-9_-]{1,64}$/i.test(value)) query.set(key, value);
  }
  return redirectWithinDellys(request, target, query);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|js|mjs|css|map|json|txt|xml|webmanifest|woff|woff2|ttf|otf|mp4|webm)$).*)",
  ],
};
