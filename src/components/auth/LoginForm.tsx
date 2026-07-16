"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/staff";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";

export function LoginForm({
  lang,
  dict,
  nextSession,
}: {
  lang: Locale;
  dict: Dictionary;
  nextSession: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Any bare username (no "@") reveals the password box and switches to staff
  // login — the only entry point for staff accounts (admin, dellys_admin,
  // reception…). Regular members always sign in with an email address.
  const adminMode = email.trim().length > 0 && !email.includes("@");

  function nextPath() {
    return nextSession ? `/${lang}/book/${nextSession}` : `/${lang}/dashboard`;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();

    if (adminMode) {
      const { error } = await supabase.auth.signInWithPassword({
        email: usernameToEmail(email.trim().toLowerCase()),
        password,
      });
      if (error) {
        setBusy(false);
        setError(dict.auth.invalidLogin);
        return;
      }
      // Hard navigation (not router.replace): the header/profile live in the
      // shared root layout, which a client-side navigation would NOT re-render —
      // it'd keep showing the logged-out public nav. A full load re-runs the
      // layout with the freshly-set admin session cookie.
      window.location.assign(`/${lang}/admin`);
      return;
    }

    const redirectTo = `${window.location.origin}/${lang}/auth/callback?next=${encodeURIComponent(
      nextPath(),
    )}`;
    // Send the link from an implicit-flow client — the shared @supabase/ssr
    // client is locked to PKCE, whose links only open in the browser that
    // requested them (the code_verifier cookie lives there). Implicit links
    // carry the tokens in the URL fragment, so they sign in from ANY browser:
    // Gmail/Instagram in-app browsers included. This client sends the email
    // and is thrown away; the session is stored by /auth/confirm on arrival.
    const emailAuth = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: "implicit",
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
    const { error } = await emailAuth.auth.signInWithOtp({
      email: email.trim(),
      options: {
        // No public sign-up: accounts are created at the studio (book a session,
        // give reception your email). Login only works for existing accounts.
        shouldCreateUser: false,
        emailRedirectTo: redirectTo,
      },
    });
    setBusy(false);
    if (error) {
      const m = `${error.message ?? ""} ${(error as { code?: string }).code ?? ""}`.toLowerCase();
      const rateLimited =
        error.status === 429 || m.includes("rate limit") || m.includes("over_email_send");
      // shouldCreateUser:false → an unknown email comes back as "signups not
      // allowed" / "user not found": tell them to book first.
      const noAccount =
        m.includes("signup") || m.includes("not allowed") || m.includes("user not found");
      setError(
        rateLimited
          ? dict.auth.rateLimited
          : noAccount
            ? dict.auth.noAccountFound
            : dict.common.error,
      );
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-6">
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {dict.auth.linkSent}
        </div>
        <button
          type="button"
          onClick={() => {
            setSent(false);
            setError(null);
          }}
          className="mt-3 text-xs text-mauve-500 hover:text-mauve-800"
        >
          {dict.auth.back}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      {error && <div className="alert-error">{error}</div>}

      <div>
        <label className="label" htmlFor="email">
          {dict.auth.emailLabel}
        </label>
        <input
          id="email"
          type={adminMode ? "text" : "email"}
          inputMode="email"
          required
          autoComplete="email"
          className="input"
          placeholder={dict.auth.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {adminMode && (
        <div>
          <label className="label" htmlFor="password">
            {dict.auth.adminPasswordLabel}
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !email || (adminMode && !password)}
        className="btn-primary w-full"
      >
        {busy ? dict.common.loading : adminMode ? dict.auth.staffLogin : dict.auth.sendLink}
      </button>
    </form>
  );
}
