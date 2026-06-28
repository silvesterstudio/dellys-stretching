"use client";

// Friendly fallback for any unhandled error in this segment. error.tsx is always
// a client component and can't read the dictionary, so it keeps a tiny inline
// string map and resolves the active locale from <html lang> (set by the layout)
// instead of showing both languages at once.
import { useEffect, useState } from "react";

const T = {
  ro: {
    title: "Ceva nu a mers",
    body: "Încearcă din nou într-o clipă.",
    retry: "Reîncearcă",
    home: "Acasă",
  },
  ru: {
    title: "Что-то пошло не так",
    body: "Попробуйте ещё раз через мгновение.",
    retry: "Повторить",
    home: "Главная",
  },
} as const;

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [lang, setLang] = useState<"ro" | "ru">("ro");
  useEffect(() => {
    if (document.documentElement.lang === "ru") setLang("ru");
  }, []);
  const t = T[lang];

  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <div className="card p-8">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-mauve-100 text-2xl">
          ✦
        </div>
        <h1 className="font-display text-xl font-medium text-mauve-900">{t.title}</h1>
        <p className="mt-2 text-sm text-mauve-500">{t.body}</p>
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="btn-primary">
            {t.retry}
          </button>
          <a href={`/${lang}`} className="btn-secondary">
            {t.home}
          </a>
        </div>
      </div>
    </div>
  );
}
