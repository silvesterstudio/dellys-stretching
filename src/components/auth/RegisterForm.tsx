"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signUpAction } from "@/app/[lang]/register/actions";
import { MIN_PASSWORD, type Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";

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
  const [password, setPassword] = useState("");
  const [locationKey, setLocationKey] = useState(locations[0]?.key ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const message = (code: string) =>
    ({
      INVALID_NAME: a.errName,
      INVALID_PHONE: a.errPhone,
      INVALID_EMAIL: a.errEmail,
      WEAK_PASSWORD: a.errPassword,
      EMAIL_TAKEN: a.errEmailTaken,
    })[code] ?? dict.common.error;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    const res = await signUpAction({ fullName, phone, email, password, locationKey });
    if (res.error) {
      setError(message(res.error));
      setBusy(false);
      return;
    }

    // The account is created already-confirmed, so sign straight in with the
    // password just chosen — no mail round trip.
    const supabase = createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (signInErr) {
      // Account exists but the session didn't take — send them to log in
      // rather than leaving them stuck on a spinner.
      window.location.assign(`/${lang}/login`);
      return;
    }
    // Hard navigation so the root layout re-renders with the new session.
    window.location.assign(
      nextSession ? `/${lang}/book/${nextSession}` : `/${lang}/dashboard?welcome=1`,
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

      <div>
        <label className="label" htmlFor="password">
          {a.password}
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-mauve-400">{a.passwordHint}</p>
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
        disabled={busy || !fullName || !phone || !email || password.length < MIN_PASSWORD}
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
