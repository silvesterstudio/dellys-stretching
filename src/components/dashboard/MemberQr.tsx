"use client";

import { useEffect, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";

// The member's door code. It renders client-side from the raw token so the
// image never has to be stored or served — and it stays out of any server log.
export function MemberQr({
  token,
  dict,
}: {
  token: string;
  dict: Dictionary;
}) {
  const t = dict.dashboard;
  const [src, setSrc] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const QRCode = (await import("qrcode")).default;
      // High error correction: a phone screen at an angle, behind a case, or
      // with a fingerprint on it still decodes.
      const url = await QRCode.toDataURL(token, {
        errorCorrectionLevel: "H",
        margin: 1,
        width: 640,
        color: { dark: "#16151b", light: "#ffffff" },
      });
      if (!cancelled) setSrc(url);
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Escape closes the enlarged view; while it is open the page behind must not
  // scroll under it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <section className="card flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center sm:gap-6">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={t.qrOpen}
          className="shrink-0 rounded-2xl border border-mauve-100 bg-white p-3 transition-transform active:scale-95"
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element -- data: URI generated in the browser
            <img src={src} alt="" width={168} height={168} className="block h-[168px] w-[168px]" />
          ) : (
            <div className="h-[168px] w-[168px] animate-pulse rounded-lg bg-mauve-50" />
          )}
        </button>

        <div className="min-w-0 text-center sm:text-left">
          <h2 className="font-display text-xl font-bold text-mauve-900">{t.qrTitle}</h2>
          <p className="mt-1.5 text-sm text-mauve-500">{t.qrHint}</p>
          <button type="button" onClick={() => setOpen(true)} className="btn-secondary mt-4 py-1.5 text-sm">
            {t.qrOpen}
          </button>
        </div>
      </section>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t.qrTitle}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-6"
        >
          {src && (
            // eslint-disable-next-line @next/next/no-img-element -- data: URI generated in the browser
            <img
              src={src}
              alt=""
              className="h-auto w-full max-w-[min(78vw,78vh)] rounded-xl"
            />
          )}
          <p className="text-center text-sm font-medium text-mauve-500">
            {t.qrFullscreenHint}
          </p>
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
            {t.qrClose}
          </button>
        </div>
      )}
    </>
  );
}
