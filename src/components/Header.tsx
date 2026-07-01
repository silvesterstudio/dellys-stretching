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
  const ctaHref = `${base}#schedule`;
  const ctaLabel = dict.home.hero.ctaPrimary;

  // Clients see marketing anchors (the landing sections) + their account; admins
  // just get the admin panel. Booking CTA is client-facing only.
  const links = isAdmin
    ? [{ href: `${base}/admin`, label: dict.nav.admin }]
    : [
        { href: `${base}#schedule`, label: dict.nav.schedule },
        { href: `${base}#plans`, label: dict.nav.prices },
        { href: `${base}#faq`, label: dict.nav.faq },
        ...(profile ? [{ href: `${base}/dashboard`, label: dict.nav.dashboard }] : []),
      ];

  return (
    <header className="sticky top-0 z-30 border-b border-mauve-100 bg-white/85 backdrop-blur">
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
            <Link key={l.href} href={l.href} className="btn-ghost px-3 py-2 text-sm">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher current={lang} />
          <div className="hidden items-center gap-2 md:flex">
            {profile ? (
              <>
                {!isAdmin && (
                  <Link href={ctaHref} className="btn-primary py-2 text-sm">
                    {ctaLabel}
                  </Link>
                )}
                <LogoutButton label={dict.nav.logout} />
              </>
            ) : (
              <>
                <Link href={`${base}/login`} className="btn-ghost px-3 py-2 text-sm">
                  {dict.nav.login}
                </Link>
                <Link href={ctaHref} className="btn-primary py-2 text-sm">
                  {ctaLabel}
                </Link>
              </>
            )}
          </div>
          <MobileNav
            links={links}
            loggedIn={!!profile}
            loginHref={`${base}/login`}
            loginLabel={dict.nav.login}
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
