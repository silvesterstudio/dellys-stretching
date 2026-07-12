"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Profile } from "@/lib/auth";
import { DC } from "@/lib/dc";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoutButton } from "./LogoutButton";
import { MobileNav } from "./MobileNav";
import { LogoMark } from "./LogoMark";

export function Header({
  lang,
  dict,
  profile,
}: {
  lang: Locale;
  dict: Dictionary;
  profile: Profile | null;
}) {
  const base = `/${lang}`;
  const pathname = usePathname();

  const isAdmin = profile?.role === "admin";
  const isStaff = isAdmin || profile?.role === "reception";
  const onAdminPage = pathname.includes(`${base}/admin`) || pathname.includes("/admin");
  const ctaHref = `${base}#program`;
  const ctaLabel = dict.home.nav.book;

  // On an admin page the island bar itself becomes the admin nav (no separate
  // tab row): admins get every section, reception staff only check-in.
  // Restricted admins (dashboard_access=false) keep every section except the
  // financial dashboard.
  const canDashboard = isAdmin && profile?.dashboard_access !== false;
  const adminTabs = isAdmin
    ? [
        { href: `${base}/admin/today`, label: dict.admin.todayTab },
        ...(canDashboard
          ? [{ href: `${base}/admin/dashboard`, label: dict.admin.dashboardTab }]
          : []),
        { href: `${base}/admin/templates`, label: dict.admin.templates },
        { href: `${base}/admin/members`, label: dict.admin.members },
        { href: `${base}/admin/plans`, label: dict.admin.plansTab },
      ]
    : [{ href: `${base}/admin/today`, label: dict.admin.todayTab }];

  const showAdminNav = onAdminPage && isStaff;

  // Off the admin panel the bar shows the site's own nav. Staff also get an
  // "Administrare" link back into the panel; regular members get "Dashboard".
  const publicLinks = [
    { href: `${base}#discipline`, label: dict.nav.disciplines },
    { href: `${base}#program`, label: dict.nav.schedule },
    { href: `${base}#preturi`, label: dict.nav.prices },
  ];
  const links = showAdminNav
    ? adminTabs
    : [
        ...publicLinks,
        ...(isStaff
          ? [{ href: `${base}/admin`, label: dict.nav.admin }]
          : profile
            ? [{ href: `${base}/dashboard`, label: dict.nav.dashboard }]
            : []),
      ];

  // Active admin tab = the one whose href is the longest prefix of the path.
  const activeHref = showAdminNav
    ? links.reduce<string | null>((acc, t) => {
        const m = pathname === t.href || pathname.startsWith(t.href + "/");
        return m && t.href.length > (acc?.length ?? -1) ? t.href : acc;
      }, null)
    : null;

  const navLink: React.CSSProperties = {
    textDecoration: "none",
    color: "rgba(26,20,32,.82)",
    fontWeight: 600,
    fontSize: 15,
    transition: "color .2s",
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        padding: "14px 16px 0",
        background: "transparent",
        fontFamily: DC.sans,
      }}
    >
      {/* Floating "island": rounded light glass bar detached from the page edges. */}
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 14px 0 22px",
          height: 62,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
          borderRadius: 999,
          background: "rgba(255,255,255,.72)",
          border: "1px solid rgba(26,20,32,.08)",
          backdropFilter: "saturate(1.5) blur(18px)",
          WebkitBackdropFilter: "saturate(1.5) blur(18px)",
          boxShadow: "0 18px 44px -24px rgba(60,40,70,.28)",
        }}
      >
        <Link
          href={base}
          aria-label={dict.brand}
          style={{
            textDecoration: "none",
            flex: "none",
            // Soft lift for the pink lockup on the light glass.
            filter: "drop-shadow(0 2px 8px rgba(60,40,70,.14))",
          }}
        >
          <LogoMark priority />
        </Link>

        <nav
          className={`hidden md:flex ${showAdminNav ? "no-scrollbar" : ""}`}
          style={{
            alignItems: "center",
            gap: showAdminNav ? 4 : 26,
            // The 5 admin pills can exceed a small-laptop island; let them shrink
            // and scroll horizontally instead of pushing the logout off-screen.
            ...(showAdminNav ? { minWidth: 0, overflowX: "auto", flexShrink: 1 } : {}),
          }}
        >
          {links.map((l) =>
            showAdminNav ? (
              // Admin section nav: every item is a pill (active = filled accent,
              // others quiet with a soft hover) so they space evenly.
              <Link
                key={l.href}
                href={l.href}
                aria-current={l.href === activeHref ? "page" : undefined}
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  l.href === activeHref
                    ? "bg-brand-600 text-white"
                    : "text-mauve-700 hover:bg-mauve-100"
                }`}
              >
                {l.label}
              </Link>
            ) : (
              <Link key={l.href} href={l.href} style={navLink}>
                {l.label}
              </Link>
            ),
          )}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* Desktop keeps the language pills inline; on mobile they move into
              the menu so the bar stays a clean logo + hamburger. */}
          <div className="hidden md:flex">
            <LanguageSwitcher current={lang} variant="light" />
          </div>
          <div className="hidden md:flex" style={{ alignItems: "center", gap: 14 }}>
            {profile ? (
              <LogoutButton label={dict.nav.logout} />
            ) : (
              <Link href={`${base}/login`} style={navLink}>
                {dict.home.nav.login}
              </Link>
            )}
            {!isStaff && (
              <Link
                href={ctaHref}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  background: DC.accent,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 14,
                  padding: "10px 20px",
                  borderRadius: 999,
                  textDecoration: "none",
                }}
              >
                {ctaLabel}
              </Link>
            )}
          </div>
          {/* Mobile-only quick calendar shortcut straight to the program. */}
          {!showAdminNav && (
            <a
              href={`${base}#program`}
              aria-label={dict.nav.schedule}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-mauve-200 bg-white/80 text-mauve-700 md:hidden"
            >
              <svg
                width="19"
                height="19"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
                <path d="M3 9h18M8 2.5v4M16 2.5v4" />
                <path d="M7.5 13h2M11 13h2M14.5 13h2M7.5 16.5h2M11 16.5h2" />
              </svg>
            </a>
          )}
          <MobileNav
            lang={lang}
            links={links}
            loggedIn={!!profile}
            loginHref={`${base}/login`}
            loginLabel={dict.home.nav.login}
            signupHref={ctaHref}
            signupLabel={ctaLabel}
            logoutLabel={dict.nav.logout}
            menuLabel={dict.common.menu}
          />
        </div>
      </div>
    </header>
  );
}
