"use client";

import { useEffect, useState } from "react";
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
  const isHome = pathname === base;

  // On the homepage the hero is a dark full-bleed image; the header floats
  // transparently over it until the user scrolls, then it becomes solid white.
  // Everywhere else it is always solid.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const overlay = isHome && !scrolled;

  const isAdmin = profile?.role === "admin";
  const ctaHref = `${base}#program`;
  const ctaLabel = dict.home.nav.book;

  const links = isAdmin
    ? [{ href: `${base}/admin`, label: dict.nav.admin }]
    : [
        { href: `${base}#discipline`, label: dict.nav.disciplines },
        { href: `${base}#program`, label: dict.nav.schedule },
        { href: `${base}#preturi`, label: dict.nav.prices },
        { href: `${base}#faq`, label: dict.nav.faq },
        ...(profile ? [{ href: `${base}/dashboard`, label: dict.nav.dashboard }] : []),
      ];

  const navLink: React.CSSProperties = {
    textDecoration: "none",
    color: overlay ? "rgba(255,255,255,.92)" : "#4A4954",
    fontWeight: 600,
    fontSize: 15,
    transition: "color .3s",
  };

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        backdropFilter: overlay ? "none" : "saturate(1.5) blur(16px)",
        WebkitBackdropFilter: overlay ? "none" : "saturate(1.5) blur(16px)",
        background: overlay ? "transparent" : "rgba(255,255,255,.82)",
        borderBottom: `1px solid ${overlay ? "transparent" : DC.border2}`,
        fontFamily: DC.sans,
        transition: "background .3s, border-color .3s, backdrop-filter .3s",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 20,
        }}
      >
        <Link
          href={base}
          aria-label={dict.brand}
          style={{
            textDecoration: "none",
            flex: "none",
            // Lift the pink lockup off the photo when floating over the hero.
            filter: overlay ? "drop-shadow(0 2px 10px rgba(0,0,0,.35))" : "none",
            transition: "filter .3s",
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
          <LanguageSwitcher current={lang} />
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
                  boxShadow: overlay ? "0 10px 30px -12px rgba(224,17,95,.7)" : "none",
                  transition: "box-shadow .3s",
                }}
              >
                {ctaLabel}
              </Link>
            )}
          </div>
          <MobileNav
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
