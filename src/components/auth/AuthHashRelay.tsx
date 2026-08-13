"use client";

import { useEffect } from "react";
import type { Locale } from "@/lib/constants";

// Safety net for magic-link sign-in.
//
// The login form asks GoTrue to send the user back to /{lang}/auth/confirm.
// GoTrue only honours that when the URL matches Supabase's redirect allow-list
// (uri_allow_list); when it does not, it SILENTLY substitutes the bare Site URL
// instead of erroring. The user then lands on the home page with the session
// tokens still sitting in the URL #fragment and nothing there to consume them,
// so the click appears to do nothing and they are never signed in.
//
// Relying on a dashboard setting to keep login working is too fragile, so this
// catches an auth fragment wherever it lands and forwards it — fragment intact —
// to the page that knows how to exchange it. Costs one effect on mount and does
// nothing at all on a normal page view.
export function AuthHashRelay({ locale }: { locale: Locale }) {
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.length < 2) return;

    // Never bounce the page that already handles this, or we'd loop.
    if (window.location.pathname.includes("/auth/confirm")) return;

    const p = new URLSearchParams(hash.replace(/^#/, ""));
    // Only react to a real GoTrue payload: a full token pair, or its error
    // report for an expired/consumed link. Anything else is a normal anchor.
    const isAuth =
      (p.has("access_token") && p.has("refresh_token")) ||
      p.has("error_code") ||
      (p.has("error") && p.has("error_description"));
    if (!isAuth) return;

    window.location.replace(`/${locale}/auth/confirm${hash}`);
  }, [locale]);

  return null;
}
