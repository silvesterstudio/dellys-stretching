"use client";

import Link from "next/link";
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

  const isAdmin = profile?.role === "admin";
  const ctaHref = `${base}#program`;
  const ctaLabel = dict.home.nav.book;

  const links = isAdmin
    ? [{ href: `${base}/admin`, label: dict.nav.admin }]
    : [
        { href: `${base}#discipline`, label: dict.nav.disciplines },
        { href: `${base}#program`, label: dict.nav.schedule },
        { href: `${base}#preturi`, label: dict.nav.prices },
        ...(profile ? [{ href: `${base}/dashboard`, label: dict.nav.dashboard }] : []),
      ];

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

        <nav className="hidden md:flex" style={{ alignItems: "center", gap: 26 }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={navLink}>
              {l.label}
            </Link>
          ))}
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
            {!isAdmin && (
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
