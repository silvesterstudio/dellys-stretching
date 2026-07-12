"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/constants";
import type { Dictionary } from "@/i18n/get-dictionary";
import { DC } from "@/lib/dc";
import { createGuestBooking } from "@/app/[lang]/reserve/[sessionId]/actions";

// No-login "first reservation": a lightweight popup asking only for full name +
// phone. On success a real seat is held (spots-left drops live) and the lead is
// forwarded to the studio's messaging automation.
export function GuestBookingModal({
  lang,
  dict,
  sessionId,
  className,
  timeLabel,
  onClose,
  onBooked,
}: {
  lang: Locale;
  dict: Dictionary;
  sessionId: string;
  className: string;
  timeLabel: string;
  onClose: () => void;
  onBooked: (sessionId: string) => void;
}) {
  const r = dict.reserve;
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
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
    const res = await createGuestBooking({ sessionId, fullName, phone, lang });
    setBusy(false);
    if (!res.ok) {
      setError(res.error === "unavailable" ? r.errorUnavailable : r.errorInvalid);
      return;
    }
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
              <label className="label" htmlFor="gName">{r.nameLabel}</label>
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
            <div>
              <label className="label" htmlFor="gPhone">{r.phoneLabel}</label>
              <input
                id="gPhone"
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
          </form>
        )}
      </div>
    </div>
  );
}
