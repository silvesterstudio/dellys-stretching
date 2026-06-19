"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { usernameToEmail } from "@/lib/staff";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";

export function StaffLoginForm({
  lang,
  dict,
}: {
  lang: Locale;
  dict: Dictionary;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(username),
      password,
    });
    if (error) {
      setBusy(false);
      setError(dict.auth.invalidLogin);
      return;
    }
    router.refresh();
    router.replace(`/${lang}/admin`);
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      {error && (
        <div className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div>
        <label className="label" htmlFor="u">
          {dict.auth.username}
        </label>
        <input
          id="u"
          className="input"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>
      <div>
        <label className="label" htmlFor="p">
          {dict.auth.password}
        </label>
        <input
          id="p"
          type="password"
          className="input"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <button type="submit" disabled={busy || !username || !password} className="btn-primary w-full">
        {busy ? dict.common.loading : dict.auth.staffLogin}
      </button>
    </form>
  );
}
