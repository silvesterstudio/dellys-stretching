"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
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
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Where to land after the user clicks the magic link.
  function nextPath() {
    return nextSession
      ? `/${lang}/book/${nextSession}`
      : `/${lang}/dashboard`;
  }

  async function sendLink(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/${lang}/auth/callback?next=${encodeURIComponent(
      nextPath(),
    )}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
        data: { preferred_lang: lang },
      },
    });
    setBusy(false);
    if (error) {
      setError(dict.common.error);
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-5">
        <div className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
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
    <form onSubmit={sendLink} className="mt-5 space-y-3">
      {error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="email">
          {dict.auth.emailLabel}
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className="input"
          placeholder={dict.auth.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <button type="submit" disabled={busy || !email} className="btn-primary w-full">
        {busy ? dict.common.loading : dict.auth.sendLink}
      </button>
    </form>
  );
}
