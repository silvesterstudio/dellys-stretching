import Link from "next/link";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Profile } from "@/lib/auth";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { LogoutButton } from "./LogoutButton";

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
  return (
    <header className="sticky top-0 z-30 border-b border-mauve-100 bg-sand-50/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link href={base} className="font-display text-2xl font-bold text-brand-600">
          {dict.brand}
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          <Link href={base} className="btn-ghost">
            {dict.nav.schedule}
          </Link>
          <Link href={`${base}/memberships`} className="btn-ghost">
            {dict.nav.memberships}
          </Link>
          {profile && (
            <Link href={`${base}/dashboard`} className="btn-ghost">
              {dict.nav.dashboard}
            </Link>
          )}
          {profile?.role === "admin" && (
            <Link href={`${base}/admin`} className="btn-ghost">
              {dict.nav.admin}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSwitcher current={lang} />
          {profile ? (
            <LogoutButton label={dict.nav.logout} />
          ) : (
            <Link href={`${base}/login`} className="btn-primary">
              {dict.nav.login}
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
