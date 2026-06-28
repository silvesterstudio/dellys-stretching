"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/staff";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";

export function LoginForm({
  lang,
  dict,
  nextSession,
  mode = "login",
}: {
  lang: Locale;
  dict: Dictionary;
  nextSession: string | null;
  // "login" asks only for email; "signup" also collects name + phone.
  mode?: "login" | "signup";
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // Typing "admin" in the email field reveals the password box and switches to
  // staff login — the only entry point for admins (no separate /staff link).
  const adminMode = email.trim().toLowerCase() === "admin";
  // Name + phone are collected only when signing up (and never for admin login).
  const showProfileFields = mode === "signup" && !adminMode;

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
        email: usernameToEmail("admin"),
        password,
      });
      if (error) {
        setBusy(false);
        setError(dict.auth.invalidLogin);
        return;
      }
      router.refresh();
      router.replace(`/${lang}/admin`);
      return;
    }

    const redirectTo = `${window.location.origin}/${lang}/auth/callback?next=${encodeURIComponent(
      nextPath(),
    )}`;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo,
        // Stored on the new profile by the handle_new_user trigger.
        data: { preferred_lang: lang, full_name: fullName.trim(), phone: phone.trim() },
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

      {showProfileFields && (
        <>
          <div>
            <label className="label" htmlFor="fullName">
              {dict.auth.fullNameLabel}
            </label>
            <input
              id="fullName"
              type="text"
              required
              autoComplete="name"
              className="input"
              placeholder={dict.auth.namePlaceholder}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="phone">
              {dict.auth.phoneLabel}
            </label>
            <input
              id="phone"
              type="tel"
              required
              autoComplete="tel"
              className="input"
              placeholder={dict.auth.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
        </>
      )}

      <button
        type="submit"
        disabled={
          busy ||
          !email ||
          (adminMode ? !password : showProfileFields && (!fullName || !phone))
        }
        className="btn-primary w-full"
      >
        {busy ? dict.common.loading : adminMode ? dict.auth.staffLogin : dict.auth.sendLink}
      </button>
    </form>
  );
}
