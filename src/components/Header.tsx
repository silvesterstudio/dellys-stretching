import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Profile } from "@/lib/auth";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoutButton } from "./LogoutButton";
import { MobileNav } from "./MobileNav";

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
  // Role-aware nav: everyone sees the schedule. Memberships + "my account" are
  // client-facing, so they're hidden for admins; the admin panel link only shows
  // for admins. (Login/logout is handled separately below.)
  const links = [
    { href: base, label: dict.nav.schedule },
    ...(!isAdmin ? [{ href: `${base}/memberships`, label: dict.nav.memberships }] : []),
    ...(profile && !isAdmin
      ? [{ href: `${base}/dashboard`, label: dict.nav.dashboard }]
      : []),
    ...(isAdmin ? [{ href: `${base}/admin`, label: dict.nav.admin }] : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-mauve-100 bg-white">
      <div className="container-page relative flex items-center justify-between gap-3 py-3">
        <Link href={base} className="flex items-center" aria-label={dict.brand}>
          <Image
            src="/dellys-logo.webp"
            alt={dict.brand}
            width={1053}
            height={266}
            priority
            sizes="(max-width: 640px) 112px, 128px"
            className="h-7 w-auto sm:h-8"
          />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="btn-ghost">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher current={lang} />
          <div className="hidden md:block">
            {profile ? (
              <LogoutButton label={dict.nav.logout} />
            ) : (
              <Link href={`${base}/login`} className="btn-primary">
                {dict.nav.login}
              </Link>
            )}
          </div>
          <MobileNav
            links={links}
            loggedIn={!!profile}
            loginHref={`${base}/login`}
            loginLabel={dict.nav.login}
            logoutLabel={dict.nav.logout}
            menuLabel={dict.common.menu}
          />
        </div>
      </div>
    </header>
  );
}
