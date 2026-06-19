import Link from "next/link";
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
  const links = [
    { href: base, label: dict.nav.schedule },
    { href: `${base}/memberships`, label: dict.nav.memberships },
    ...(profile ? [{ href: `${base}/dashboard`, label: dict.nav.dashboard }] : []),
    ...(profile?.role === "admin"
      ? [{ href: `${base}/admin`, label: dict.nav.admin }]
      : []),
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-sand-50/70 backdrop-blur-xl">
      <div className="container-page relative flex items-center justify-between gap-3 py-3">
        <Link href={base} className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-2xl bg-brand-500 font-display text-lg font-bold text-white shadow-sm shadow-brand-500/40">
            D
          </span>
          <span className="font-display text-2xl font-bold tracking-tight text-mauve-900">
            {dict.brand}
          </span>
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
          />
        </div>
      </div>
    </header>
  );
}
