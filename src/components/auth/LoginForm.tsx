"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, data: { preferred_lang: lang } },
    });
    setBusy(false);
    if (error) {
      setError(dict.common.error);
      return;
    }
    setInfo(dict.auth.checkEmail);
    setStep("code");
  }

  async function verify(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    if (error) {
      setBusy(false);
      setError(dict.auth.invalidCode);
      return;
    }
    // Session is set. Go to the booking the user came for, or their dashboard.
    const dest = nextSession
      ? `/${lang}/book/${nextSession}`
      : `/${lang}/dashboard`;
    router.refresh();
    router.replace(dest);
  }

  return (
    <div className="mt-5">
      {error && (
        <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {info && step === "code" && (
        <div className="mb-3 rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-700">
          {info}
        </div>
      )}

      {step === "email" ? (
        <form onSubmit={sendCode} className="space-y-3">
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
            {busy ? dict.common.loading : dict.auth.sendCode}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <div>
            <label className="label" htmlFor="code">
              {dict.auth.codeLabel}
            </label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              className="input tracking-[0.4em] text-center text-lg"
              placeholder={dict.auth.codePlaceholder}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>
          <button type="submit" disabled={busy || !code} className="btn-primary w-full">
            {busy ? dict.common.loading : dict.auth.verify}
          </button>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setInfo(null);
                setError(null);
              }}
              className="text-mauve-500 hover:text-mauve-800"
            >
              {dict.auth.back}
            </button>
            <button
              type="button"
              onClick={() => sendCode()}
              disabled={busy}
              className="text-brand-600 hover:text-brand-700"
            >
              {dict.auth.resend}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
