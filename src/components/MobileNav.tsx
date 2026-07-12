"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/constants";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface NavLink {
  href: string;
  label: string;
}

export function MobileNav({
  lang,
  links,
  loggedIn,
  loginHref,
  loginLabel,
  signupHref,
  signupLabel,
  logoutLabel,
  menuLabel,
}: {
  lang: Locale;
  links: NavLink[];
  loggedIn: boolean;
  loginHref: string;
  loginLabel: string;
  signupHref: string;
  signupLabel: string;
  logoutLabel: string;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    // Move focus into the menu so keyboard / screen-reader users land inside it.
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    setOpen(false);
    router.refresh();
    router.push("/");
  }

  return (
    <div className="md:hidden">
      <button
        aria-label={menuLabel}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-10 w-10 items-center justify-center rounded-full border border-mauve-200 bg-white/80 text-mauve-700"
      >
        <span className="relative block h-4 w-5">
          <span
            className={`absolute left-0 block h-0.5 w-5 rounded bg-current transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`}
          />
          <span
            className={`absolute left-0 top-1.5 block h-0.5 w-5 rounded bg-current transition-all ${open ? "opacity-0" : "opacity-100"}`}
          />
          <span
            className={`absolute left-0 block h-0.5 w-5 rounded bg-current transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`}
          />
        </span>
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-mauve-900/25 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className="absolute left-0 right-0 top-full z-50 mx-2 mt-3 animate-rise overflow-hidden rounded-[26px] border border-mauve-100 bg-white shadow-2xl shadow-mauve-900/10"
          >
            {/* Header row inside the sheet: label + close. */}
            <div className="flex items-center justify-between border-b border-mauve-100/80 px-5 py-3.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-mauve-400">
                {menuLabel}
              </span>
              <button
                aria-label={menuLabel}
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-mauve-400 hover:bg-mauve-50 hover:text-mauve-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav className="px-2.5 py-2.5">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-2xl px-3.5 py-3 text-[15.5px] font-medium text-mauve-800 transition-colors hover:bg-brand-50 hover:text-brand-700"
                >
                  {l.label}
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-mauve-300" aria-hidden>
                    <path d="M9 6l6 6-6 6" />
                  </svg>
                </Link>
              ))}
            </nav>

            <div className="border-t border-mauve-100/80 px-4 py-4">
              {loggedIn ? (
                <button
                  onClick={logout}
                  className="block w-full rounded-2xl bg-mauve-50 px-4 py-3 text-center text-[15px] font-semibold text-mauve-600 hover:bg-mauve-100"
                >
                  {logoutLabel}
                </button>
              ) : (
                <div className="space-y-2.5">
                  <Link
                    href={signupHref}
                    onClick={() => setOpen(false)}
                    className="btn-primary w-full"
                  >
                    {signupLabel}
                  </Link>
                  <Link
                    href={loginHref}
                    onClick={() => setOpen(false)}
                    className="btn-secondary w-full"
                  >
                    {loginLabel}
                  </Link>
                </div>
              )}
            </div>

            {/* Language pills live here on mobile (hidden from the top bar). */}
            <div className="flex justify-center border-t border-mauve-100/80 px-4 py-4">
              <LanguageSwitcher current={lang} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
