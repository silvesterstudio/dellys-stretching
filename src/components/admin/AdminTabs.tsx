"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Pill tab bar with active highlighting. The active tab is the one whose href is
// the longest prefix of the current path, so /admin/sessions/[id] highlights the
// "Sessions" (/admin) tab and /admin/dashboard highlights "Dashboard" — without
// /admin (a prefix of every admin route) hijacking the highlight.
export function AdminTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  const best = tabs.reduce<{ href: string; label: string } | null>((acc, t) => {
    const matches = pathname === t.href || pathname.startsWith(t.href + "/");
    if (matches && t.href.length > (acc?.href.length ?? -1)) return t;
    return acc;
  }, null);

  return (
    <nav className="no-scrollbar mb-6 flex gap-1.5 overflow-x-auto pb-1">
      {tabs.map((t) => {
        const active = best?.href === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active
                ? "bg-brand-600 text-white shadow-sm shadow-brand-500/25"
                : "text-mauve-600 hover:bg-mauve-100"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
