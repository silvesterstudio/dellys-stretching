"use client";

import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Locale } from "@/lib/constants";

// Completes an implicit-flow magic-link sign-in. The email link lands here
// with the session tokens in the URL #fragment (which only the browser can
// read). The shared Supabase client is locked to PKCE and would reject this
// callback shape, so we parse the fragment ourselves and hand the tokens to
// setSession(), which persists them into the auth cookies. Then we hard-
// navigate to `next` — a full load so the root layout re-renders with the
// fresh session (client-side nav would keep the logged-out header).
export function AuthConfirm({
  locale,
  next,
  loadingLabel,
}: {
  locale: Locale;
  next: string;
  loadingLabel: string;
}) {
  useEffect(() => {
    let cancelled = false;
    const fail = () => {
      if (!cancelled) window.location.replace(`/${locale}/login?error=link`);
    };
    const go = (user: User | null | undefined) => {
      if (cancelled) return;
      // First-ever sign-in ⇒ a freshly created account. Flag it so the client
      // can fire the Meta "CompleteRegistration" conversion once on arrival.
      const createdMs = user?.created_at ? new Date(user.created_at).getTime() : 0;
      const isNew = createdMs > 0 && Date.now() - createdMs < 5 * 60 * 1000;
      const sep = next.includes("?") ? "&" : "?";
      window.location.replace(isNew ? `${next}${sep}welcome=1` : next);
    };

    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    // GoTrue reports bad/expired links as #error=…&error_code=otp_expired.
    if (hash.get("error") || hash.get("error_code")) {
      fail();
      return;
    }

    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const supabase = createClient();

    if (accessToken && refreshToken) {
      // Keep the tokens out of the browser history before storing the session.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      supabase.auth
        .setSession({ access_token: accessToken, refresh_token: refreshToken })
        .then(({ data, error }) => (error || !data.session ? fail() : go(data.session.user)))
        .catch(fail);
    } else {
      // No tokens (link reopened, fragment stripped…) — pass through if this
      // browser is already signed in, otherwise it's a dead link.
      supabase.auth
        .getSession()
        .then(({ data }) => (data.session ? go(data.session.user) : fail()))
        .catch(fail);
    }

    return () => {
      cancelled = true;
    };
  }, [locale, next]);

  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center" aria-busy="true">
      <div className="animate-pulse text-sm text-mauve-500">{loadingLabel}</div>
    </div>
  );
}
