import type { Metadata } from "next";
import type { Locale } from "@/lib/constants";
import { isLocale, localePath, languageAlternates } from "@/i18n/config";
import { privacyDoc, OPERATOR_READY } from "@/content/privacy";

export const dynamic = "force-static";

const PATH = "/confidentialitate";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const doc = privacyDoc(locale);
  return {
    title: doc.title,
    description: doc.intro[0],
    alternates: {
      canonical: localePath(locale, PATH),
      languages: languageAlternates(PATH),
    },
    // A legal notice has no business in search results competing with the
    // studio's own pages, but it must stay reachable.
    robots: { index: false, follow: true },
  };
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const doc = privacyDoc(locale);

  return (
    <div className="container-page safe-x py-10 sm:py-14">
      <article className="mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight text-mauve-900 sm:text-4xl">
          {doc.title}
        </h1>
        <p className="mt-2 text-sm text-mauve-400">{doc.updated}</p>

        {/* The operator's legal identity is the one thing that cannot be read
            out of the code. Publishing a notice that names the wrong controller
            is worse than publishing none, so say so loudly until it is set. */}
        {!OPERATOR_READY && (
          <div className="alert-error mt-6 text-sm">
            <strong>De completat înainte de publicare:</strong> denumirea juridică, IDNO,
            adresa juridică și emailul de contact ale operatorului, în{" "}
            <code className="font-mono">src/content/privacy.ts</code>. Până atunci, această
            politică este incompletă în sensul art. 13 din Legea nr. 195/2024.
          </div>
        )}

        {doc.intro.map((p, i) => (
          <p key={i} className="mt-4 text-[15px] leading-relaxed text-mauve-600">
            {p}
          </p>
        ))}

        {doc.sections.map((s) => (
          <section key={s.heading} className="mt-9">
            <h2 className="font-display text-xl font-bold tracking-tight text-mauve-900">
              {s.heading}
            </h2>

            {s.paragraphs?.map((p, i) => (
              <p key={i} className="mt-3 text-[15px] leading-relaxed text-mauve-600">
                {p}
              </p>
            ))}

            {s.bullets && (
              <ul className="mt-3 space-y-2">
                {s.bullets.map((b, i) => (
                  <li key={i} className="flex gap-2.5 text-[15px] leading-relaxed text-mauve-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}

            {s.table && (
              /* Scrolls inside itself: three columns of legal text will not fit
                 a phone, and the page body must never scroll sideways. */
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-mauve-200">
                      {s.table.head.map((h) => (
                        <th key={h} className="py-2 pr-4 font-semibold text-mauve-800">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {s.table.rows.map((row, i) => (
                      <tr key={i} className="border-b border-mauve-100 align-top">
                        {row.map((cell, j) => (
                          <td key={j} className="py-3 pr-4 leading-relaxed text-mauve-600">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}
      </article>
    </div>
  );
}
