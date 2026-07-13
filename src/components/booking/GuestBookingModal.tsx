"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { DC } from "@/lib/dc";
import { createGuestBooking } from "@/app/[lang]/reserve/[sessionId]/actions";
import { trackPixel } from "@/components/MetaPixel";

// Country codes we serve, each with its national-number length + an example.
const COUNTRIES = [
  { code: "+373", flag: "🇲🇩", len: 8, ex: "69 123 456" },
  { code: "+380", flag: "🇺🇦", len: 9, ex: "50 123 4567" },
  { code: "+7", flag: "🇷🇺", len: 10, ex: "912 345 6789" },
] as const;

type Country = (typeof COUNTRIES)[number];

// Normalise a typed phone to just the national digits for the chosen country:
// drop the country code if pasted, the trunk prefix (0, or 8 for RU), and cap.
function normalizeLocal(raw: string, country: Country): string {
  let d = raw.replace(/\D/g, "");
  const cc = country.code.replace("+", "");
  if (d.startsWith(cc)) d = d.slice(cc.length);
  if (country.code === "+7") {
    if (d.startsWith("8")) d = d.slice(1);
  } else {
    d = d.replace(/^0+/, "");
  }
  return d.slice(0, country.len);
}

// No-login "first reservation": a lightweight popup asking only for full name +
// phone. On success a real seat is held (spots-left drops live) and the lead is
// forwarded to the studio's messaging automation.
export function GuestBookingModal({
  lang,
  dict,
  sessionId,
  className,
  timeLabel,
  isChild = false,
  onClose,
  onBooked,
}: {
  lang: Locale;
  dict: Dictionary;
  sessionId: string;
  className: string;
  timeLabel: string;
  isChild?: boolean;
  onClose: () => void;
  onBooked: (sessionId: string) => void;
}) {
  const r = dict.reserve;
  const [fullName, setFullName] = useState("");
  const [childName, setChildName] = useState("");
  const [dialCode, setDialCode] = useState<string>(COUNTRIES[0].code);
  const [phone, setPhone] = useState("");
  const country = COUNTRIES.find((c) => c.code === dialCode) ?? COUNTRIES[0];
  const phoneValid = phone.length === country.len;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await createGuestBooking({
      sessionId,
      fullName,
      phone: `${dialCode}${phone}`,
      childName,
      lang,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error === "unavailable" ? r.errorUnavailable : r.errorInvalid);
      return;
    }
    // Ad-conversion signal — fires exactly once, right after the booking
    // succeeds (before the success state renders). A booking = a scheduled
    // appointment, so it's the Meta "Schedule" standard event.
    trackPixel("Schedule", { content_name: className });
    onBooked(sessionId);
    setDone(true);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={r.title}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        padding: 16,
        background: "rgba(26,20,32,.45)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        fontFamily: DC.sans,
      }}
    >
      <div
        className="animate-rise"
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#fff",
          borderRadius: 24,
          border: `1px solid ${DC.border}`,
          boxShadow: "0 30px 80px -30px rgba(40,20,50,.5)",
          padding: 24,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontFamily: DC.display, fontWeight: 600, fontSize: 20, color: DC.ink }}>
              {className}
            </div>
            <div style={{ fontSize: 14, color: DC.faint, marginTop: 2 }}>{timeLabel}</div>
          </div>
          <button
            aria-label={dict.common.back}
            onClick={onClose}
            style={{
              flex: "none",
              width: 32,
              height: 32,
              display: "grid",
              placeItems: "center",
              borderRadius: 999,
              border: "none",
              background: "#F3F2F5",
              color: DC.muted,
              cursor: "pointer",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="mt-5 text-center">
            <div className="alert-success">{r.success}</div>
            <button onClick={onClose} className="btn-primary mt-4 w-full">
              {dict.common.back}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-4 space-y-3">
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: DC.muted }}>{r.subtitle}</p>
            {error && <div className="alert-error">{error}</div>}
            <div>
              <label className="label" htmlFor="gName">
                {isChild ? r.parentNameLabel : r.nameLabel}
              </label>
              <input
                id="gName"
                ref={firstFieldRef}
                type="text"
                required
                autoComplete="name"
                className="input"
                placeholder={r.namePlaceholder}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            {isChild && (
              <div>
                <label className="label" htmlFor="gChild">{r.childNameLabel}</label>
                <input
                  id="gChild"
                  type="text"
                  required
                  className="input"
                  placeholder={r.childNamePlaceholder}
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="label" htmlFor="gPhone">{r.phoneLabel}</label>
              <div className="flex gap-2">
                <select
                  aria-label="Country code"
                  className="input w-auto shrink-0 pr-2"
                  value={dialCode}
                  onChange={(e) => {
                    setDialCode(e.target.value);
                    setPhone("");
                  }}
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </option>
                  ))}
                </select>
                <input
                  id="gPhone"
                  type="tel"
                  inputMode="numeric"
                  required
                  autoComplete="tel-national"
                  className="input"
                  placeholder={country.ex}
                  value={phone}
                  onChange={(e) => setPhone(normalizeLocal(e.target.value, country))}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={
                busy ||
                fullName.trim().length < 2 ||
                (isChild && childName.trim().length < 2) ||
                !phoneValid
              }
              className="btn-primary w-full"
            >
              {busy ? dict.common.loading : r.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
