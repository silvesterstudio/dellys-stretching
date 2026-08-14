"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";

// Sign-up is a magic link, same shape as the login form: we collect the details
// the studio needs, hand them to GoTrue as user_metadata, and let the emailed
// link create the account. The metadata is copied onto the profile row on first
// sign-in (see ensureProfileDetails), so nothing typed here is lost.
export function RegisterForm({
  lang,
  dict,
  locations,
  nextSession,
}: {
  lang: Locale;
  dict: Dictionary;
  locations: { key: string; name: string }[];
  nextSession: string | null;
}) {
  const a = dict.auth;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [locationKey, setLocationKey] = useState(locations[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const next = nextSession ? `/${lang}/book/${nextSession}` : `/${lang}/dashboard`;
    const redirectTo = `${window.location.origin}/${lang}/auth/callback?next=${encodeURIComponent(next)}`;

    // Implicit flow, like the login form: the shared client is locked to PKCE,
    // whose links only open in the browser that asked for them. Implicit links
    // carry the tokens in the fragment so they work from any mail app.
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

    const { error: err } = await emailAuth.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
        data: {
          full_name: fullName.trim().replace(/\s+/g, " "),
          phone: phone.trim(),
          location_key: locationKey,
          preferred_lang: lang,
        },
      },
    });

    setBusy(false);
    if (err) {
      const m = `${err.message ?? ""} ${(err as { code?: string }).code ?? ""}`.toLowerCase();
      if (err.status === 429 || m.includes("rate limit") || m.includes("over_email_send")) {
        setError(a.rateLimited);
      } else if (m.includes("already") || m.includes("registered")) {
        setError(a.errEmailTaken);
      } else {
        setError(dict.common.error);
      }
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mt-6">
        <div className="rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-700">
          {a.linkSent}
        </div>
        <p className="mt-3 text-center text-sm text-mauve-500">
          <Link href={`/${lang}/login`} className="font-semibold text-brand-600 hover:underline">
            {a.haveAccount}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-3">
      {error && <div className="alert-error">{error}</div>}

      <div>
        <label className="label" htmlFor="fullName">
          {a.fullNameLabel}
        </label>
        <input
          id="fullName"
          type="text"
          required
          autoComplete="name"
          className="input"
          placeholder={a.namePlaceholder}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="phone">
          {a.phoneLabel}
        </label>
        <input
          id="phone"
          type="tel"
          required
          inputMode="tel"
          autoComplete="tel"
          className="input"
          placeholder={a.phonePlaceholder}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="email">
          {a.emailLabel}
        </label>
        <input
          id="email"
          type="text"
          required
          pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
          inputMode="email"
          autoComplete="email"
          className="input"
          placeholder={a.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      {locations.length > 1 && (
        <div>
          <label className="label" htmlFor="studio">
            {a.studioLabel}
          </label>
          <select
            id="studio"
            className="input"
            value={locationKey}
            onChange={(e) => setLocationKey(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.key} value={l.key}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <button
        type="submit"
        disabled={busy || !fullName || !phone || !email}
        className="btn-primary w-full"
      >
        {busy ? dict.common.loading : a.signUpCta}
      </button>

      <p className="pt-1 text-center text-sm text-mauve-500">
        <Link href={`/${lang}/login`} className="font-semibold text-brand-600 hover:underline">
          {a.haveAccount}
        </Link>
      </p>
    </form>
  );
}
