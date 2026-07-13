"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { createGuestBooking } from "@/app/[lang]/reserve/[sessionId]/actions";
import { trackPixel } from "@/components/MetaPixel";

// No-login "first reservation" funnel: collect full name + phone and hand the
// lead to the studio's messaging automation. No account, no seat is held here —
// staff/automation confirm and message the person back.
export function GuestBookingForm({
  lang,
  dict,
  sessionId,
  loginHref,
}: {
  lang: Locale;
  dict: Dictionary;
  sessionId: string;
  loginHref: string;
}) {
  const router = useRouter();
  const r = dict.reserve;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await createGuestBooking({ sessionId, fullName, phone, lang });
    setBusy(false);
    if (!res.ok) {
      setError(res.error === "unavailable" ? r.errorUnavailable : r.errorInvalid);
      return;
    }
    trackPixel("Lead");
    setDone(true);
  }

  if (done) {
    return (
      <div className="mt-5 text-center">
        <div className="alert-success">{r.success}</div>
        <p className="mt-3 text-sm text-mauve-500">{r.successNote}</p>
        <button
          onClick={() => router.replace(`/${lang}#program`)}
          className="btn-primary mt-4 w-full"
        >
          ← {dict.nav.schedule}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-5 space-y-3">
      {error && <div className="alert-error">{error}</div>}

      <div>
        <label className="label" htmlFor="guestName">
          {r.nameLabel}
        </label>
        <input
          id="guestName"
          type="text"
          required
          autoComplete="name"
          className="input"
          placeholder={r.namePlaceholder}
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      <div>
        <label className="label" htmlFor="guestPhone">
          {r.phoneLabel}
        </label>
        <input
          id="guestPhone"
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel"
          className="input"
          placeholder={r.phonePlaceholder}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>

      <button
        type="submit"
        disabled={busy || fullName.trim().length < 2 || phone.replace(/\D/g, "").length < 6}
        className="btn-primary w-full"
      >
        {busy ? dict.common.loading : r.submit}
      </button>

      <p className="pt-1 text-center text-xs text-mauve-400">
        {r.haveAccount}{" "}
        <Link href={loginHref} className="font-medium text-brand-600 hover:text-brand-700">
          {dict.nav.login}
        </Link>
      </p>
    </form>
  );
}
