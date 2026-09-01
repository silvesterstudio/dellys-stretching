"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/constants";

// Consent for the Meta Pixel.
//
// Until now the pixel loaded on every public page for everybody, with no notice
// and no choice — visitor data went to Meta the moment a page opened. Under Law
// 195/2024 (in force 23 August 2026) that is the kind of processing that needs a
// lawful basis the visitor actually gave, and the fines run to 2,000,000 MDL.
//
// So: strictly necessary cookies keep working (session, language, studio — the
// site cannot function without them and they do not track anyone), and the pixel
// waits for a yes. No pre-ticked boxes; refusing is one tap, exactly like
// accepting, because a "choice" where refusing is harder is not consent.

export const CONSENT_KEY = "dellys_consent_analytics";
const CONSENT_EVENT = "dellys:consent";

export type ConsentValue = "granted" | "denied";

export function readConsent(): ConsentValue | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    // Private mode, or storage blocked. Treated as "not answered", which means
    // the pixel stays off — the safe direction.
    return null;
  }
}

export function writeConsent(v: ConsentValue) {
  try {
    localStorage.setItem(CONSENT_KEY, v);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: v }));
}

/** Subscribe to consent changes (and get the current value immediately). */
export function useConsent(): ConsentValue | null {
  const [value, setValue] = useState<ConsentValue | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setValue(readConsent());
    setReady(true);
    const onChange = (e: Event) => setValue((e as CustomEvent<ConsentValue>).detail);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  // Before the effect runs we genuinely do not know — report "not answered" so
  // nothing loads on that first render.
  return ready ? value : null;
}

const COPY = {
  ro: {
    text: "Folosim cookie-uri necesare pentru funcționarea site-ului. Cu acordul tău, folosim și pixelul Meta pentru a măsura eficiența reclamelor.",
    accept: "Accept",
    decline: "Doar cele necesare",
    more: "Politica de confidențialitate",
  },
  ru: {
    text: "Мы используем необходимые файлы cookie для работы сайта. С вашего согласия — также пиксель Meta для оценки эффективности рекламы.",
    accept: "Принять",
    decline: "Только необходимые",
    more: "Политика конфиденциальности",
  },
};

export function ConsentBanner({ lang }: { lang: Locale }) {
  const [answered, setAnswered] = useState<boolean | null>(null);
  const t = COPY[lang === "ru" ? "ru" : "ro"];

  useEffect(() => {
    setAnswered(readConsent() !== null);
    const onChange = () => setAnswered(true);
    window.addEventListener(CONSENT_EVENT, onChange);
    return () => window.removeEventListener(CONSENT_EVENT, onChange);
  }, []);

  // null = still reading storage. Rendering nothing avoids a banner that flashes
  // up for a visitor who answered months ago.
  if (answered === null || answered) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[900] p-3 sm:p-4"
    >
      <div className="card mx-auto flex max-w-3xl flex-col gap-3 p-4 shadow-lg sm:flex-row sm:items-center sm:gap-4">
        <p className="flex-1 text-[13px] leading-relaxed text-mauve-600">
          {t.text}{" "}
          <Link href="/confidentialitate" className="font-medium text-brand-600 underline">
            {t.more}
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          {/* Refusing is the same size and the same number of taps as accepting. */}
          <button
            onClick={() => writeConsent("denied")}
            className="btn-secondary min-h-[44px] flex-1 px-4 text-xs sm:flex-none"
          >
            {t.decline}
          </button>
          <button
            onClick={() => writeConsent("granted")}
            className="btn-primary min-h-[44px] flex-1 px-4 text-xs sm:flex-none"
          >
            {t.accept}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Footer control so the choice can be changed later, as the policy promises. */
export function ConsentReset({ lang }: { lang: Locale }) {
  const consent = useConsent();
  const label =
    lang === "ru"
      ? consent === "granted"
        ? "Статистика: включена"
        : "Статистика: выключена"
      : consent === "granted"
        ? "Statistici: activate"
        : "Statistici: dezactivate";

  return (
    <button
      onClick={() => writeConsent(consent === "granted" ? "denied" : "granted")}
      className="text-left text-xs text-mauve-400 underline transition-colors hover:text-mauve-600"
    >
      {label}
    </button>
  );
}
