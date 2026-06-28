"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface NavLink {
  href: string;
  label: string;
}

export function MobileNav({
  links,
  loggedIn,
  loginHref,
  loginLabel,
  logoutLabel,
  menuLabel,
}: {
  links: NavLink[];
  loggedIn: boolean;
  loginHref: string;
  loginLabel: string;
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
            className="fixed inset-0 z-40 bg-mauve-900/10 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            className="absolute left-0 right-0 top-full z-50 mx-3 mt-2 animate-rise rounded-3xl border border-mauve-100 bg-white p-2 shadow-xl"
          >
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-2xl px-4 py-3 text-[15px] font-medium text-mauve-800 hover:bg-mauve-50"
              >
                {l.label}
              </Link>
            ))}
            <div className="mt-1 border-t border-mauve-100 pt-2">
              {loggedIn ? (
                <button
                  onClick={logout}
                  className="block w-full rounded-2xl px-4 py-3 text-left text-[15px] font-medium text-mauve-500 hover:bg-mauve-50"
                >
                  {logoutLabel}
                </button>
              ) : (
                <Link
                  href={loginHref}
                  onClick={() => setOpen(false)}
                  className="btn-primary w-full"
                >
                  {loginLabel}
                </Link>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
