import { NextResponse, type NextRequest } from "next/server";

const movedSections = new Set([
  "admin", "book", "confidentialitate", "dashboard", "login", "memberships",
  "program", "register", "reserve", "staff", "welcome",
]);

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname === "/api/kiosk/version" || pathname === "/kiosk") return NextResponse.next();

  if (pathname.startsWith("/api/") || !["GET", "HEAD"].includes(request.method)) {
    return NextResponse.json({
      error: "Dellys has moved to Impuls Sport",
      url: "https://impulssport.md/classes",
    }, { status: 410 });
  }

  const segments = pathname.split("/").filter(Boolean);
  const prefix = segments[0] === "ro" || segments[0] === "ru" ? segments.shift() : null;
  const russian = prefix === "ru" || (!prefix && (
    request.cookies.get("NEXT_LOCALE")?.value === "ru"
    || request.headers.get("accept-language")?.toLowerCase().startsWith("ru")
  ));
  const target = new URL("https://impulssport.md/classes" + (russian ? "/ru" : ""));
  if (segments[0] === "auth") {
    target.pathname += "/login";
  } else if (movedSections.has(segments[0])) {
    target.pathname += "/" + segments.join("/");
  }
  for (const key of ["loc", "session"]) {
    const value = searchParams.get(key);
    if (value && /^[a-z0-9_-]{1,64}$/i.test(value)) target.searchParams.set(key, value);
  }
  return NextResponse.redirect(target, 307);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico|js|mjs|css|map|json|txt|xml|webmanifest|woff|woff2|ttf|otf|mp4|webm)$).*)",
  ],
};
