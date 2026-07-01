import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import type { Locale } from "@/lib/constants";
import { SITE_URL } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getWeekRange } from "@/lib/week";
import { weekdayInTz } from "@/lib/format";
import { fetchSessions } from "@/lib/queries";
import { getCurrentUserId } from "@/lib/auth";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";

export const dynamic = "force-dynamic";

function resolveLocale(lang: string): Locale {
  return (isLocale(lang) ? lang : "ro") as Locale;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const dict = getDictionary(locale);
  const path = `/${locale}`;

  return {
    title: dict.home.meta.title,
    description: dict.home.meta.description,
    keywords:
      locale === "ru"
        ? ["фитнес Кишинёв", "пилатес", "стретчинг", "гимнастика", "Fit Ball", "детская гимнастика", "Dellys"]
        : ["fitness Chișinău", "pilates", "stretching", "gimnastică", "Fit Ball", "gimnastică copii", "Dellys"],
    alternates: {
      canonical: path,
      languages: { ro: "/ro", ru: "/ru", "x-default": "/ro" },
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}${path}`,
      siteName: dict.brand,
      locale: locale === "ru" ? "ru_RU" : "ro_RO",
      title: dict.home.meta.title,
      description: dict.home.meta.description,
      // Share image supplied by the co-located opengraph-image.tsx (per locale).
    },
    twitter: {
      card: "summary_large_image",
      title: dict.home.meta.title,
      description: dict.home.meta.description,
    },
  };
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className="h-4 w-4 text-brand-600">
      <path
        d="M4 10.5l3.5 3.5L16 5.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const dict = getDictionary(locale);
  const h = dict.home;
  const base = `/${locale}`;

  // Live schedule (same Monday–Saturday window the schedule uses): on Sunday the
  // current week is all in the past, so roll forward to next week.
  const onSunday = weekdayInTz(new Date().toISOString()) === 0;
  const range = getWeekRange(onSunday ? 1 : 0);
  const days = range.days.slice(0, 6).map((d) => d.toISOString());
  const weekEnd = range.days[6];
  const startISO = range.start.toISOString();
  const endISO = weekEnd.toISOString();
  const [sessions, userId] = await Promise.all([
    fetchSessions(range.start, weekEnd),
    getCurrentUserId(),
  ]);
  const loggedIn = !!userId;

  // Structured data for Google: the business + an FAQ block (rich results).
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SportsActivityLocation",
      name: dict.brand,
      description: h.meta.description,
      url: `${SITE_URL}${base}`,
      image: `${SITE_URL}/dellys-logo.webp`,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Chișinău",
        addressCountry: "MD",
      },
      areaServed: "Chișinău",
      priceRange: "$$",
      knowsLanguage: ["ro", "ru"],
      sport: ["Pilates", "Stretching", "Gymnastics"],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: h.faq.items.map((it) => ({
        "@type": "Question",
        name: it.q,
        acceptedAnswer: { "@type": "Answer", text: it.a },
      })),
    },
  ];

  return (
    <div className="space-y-20 sm:space-y-28">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="animate-rise pt-2 text-center sm:pt-6">
        <p className="eyebrow">{h.hero.eyebrow}</p>
        <h1 className="mx-auto mt-4 max-w-3xl font-display text-4xl font-bold leading-tight tracking-tight text-mauve-900 sm:text-5xl">
          {h.hero.title}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-mauve-600">
          {h.hero.subtitle}
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#schedule" className="btn-primary w-full sm:w-auto">
            {h.hero.ctaPrimary}
          </a>
          <Link href={`${base}/memberships`} className="btn-secondary w-full sm:w-auto">
            {h.hero.ctaSecondary}
          </Link>
        </div>
        <p className="mt-5 inline-flex items-center gap-2 text-sm text-mauve-500">
          <CheckIcon />
          {h.hero.trust}
        </p>

        {/* Stats strip */}
        <dl className="mx-auto mt-12 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {h.stats.items.map((s) => (
            <div key={s.label} className="card p-4 text-center">
              <dt className="sr-only">{s.label}</dt>
              <dd>
                <span className="block font-display text-2xl font-bold text-brand-600">
                  {s.value}
                </span>
                <span className="mt-1 block text-xs font-medium text-mauve-500">
                  {s.label}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Categories */}
      <section>
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-mauve-900">
            {h.categories.title}
          </h2>
          <p className="mt-2 text-mauve-500">{h.categories.subtitle}</p>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {h.categories.items.map((c) => (
            <div key={c.title} className="card card-hover flex flex-col p-6">
              <span className="badge-success self-start">{h.categories.freeBadge}</span>
              <h3 className="mt-4 section-title">{c.title}</h3>
              <p className="mt-2 flex-1 text-sm text-mauve-600">{c.desc}</p>
              <a
                href="#schedule"
                className="btn-ghost mt-4 self-start px-0 hover:bg-transparent hover:text-brand-700"
              >
                {h.categories.cta} →
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section>
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-mauve-900">
            {h.benefits.title}
          </h2>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {h.benefits.items.map((b) => (
            <div key={b.title} className="card p-5">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50">
                <CheckIcon />
              </span>
              <h3 className="mt-4 text-base font-semibold text-mauve-900">{b.title}</h3>
              <p className="mt-1.5 text-sm text-mauve-600">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-mauve-900">
            {h.steps.title}
          </h2>
          <p className="mt-2 text-mauve-500">{h.steps.subtitle}</p>
        </div>
        <ol className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {h.steps.items.map((s, i) => (
            <li key={s.title} className="card flex flex-col p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 font-display text-lg font-bold text-white">
                {i + 1}
              </span>
              <h3 className="mt-4 section-title">{s.title}</h3>
              <p className="mt-2 text-sm text-mauve-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Free-trial band */}
      <section className="card overflow-hidden bg-sand-50 p-8 text-center sm:p-12">
        <p className="eyebrow">{h.trial.eyebrow}</p>
        <h2 className="mx-auto mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-mauve-900">
          {h.trial.title}
        </h2>
        <p className="mx-auto mt-3 max-w-2xl text-mauve-600">{h.trial.desc}</p>
        <Link
          href={loggedIn ? "#schedule" : `${base}/login?mode=signup`}
          className="btn-primary mt-7"
        >
          {h.trial.cta}
        </Link>
      </section>

      {/* Live schedule — connects to the booking system */}
      <section id="schedule" className="scroll-mt-24">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-mauve-900">
            {h.scheduleSection.title}
          </h2>
          <p className="mt-2 text-mauve-500">{h.scheduleSection.subtitle}</p>
          <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-brand-500" />
        </div>
        <div className="mt-8">
          <ScheduleGrid
            lang={locale}
            dict={dict}
            days={days}
            initialSessions={sessions}
            weekStartISO={startISO}
            weekEndISO={endISO}
            loggedIn={loggedIn}
          />
        </div>
      </section>

      {/* FAQ — no-JS accessible accordion, also emitted as JSON-LD above */}
      <section>
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-mauve-900">
            {h.faq.title}
          </h2>
        </div>
        <div className="mx-auto mt-8 max-w-2xl space-y-3">
          {h.faq.items.map((it) => (
            <details key={it.q} className="card group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium text-mauve-900">
                {it.q}
                <span className="text-brand-500 transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-mauve-600">{it.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA + location */}
      <section className="card bg-sand-50 p-8 text-center sm:p-12">
        <h2 className="font-display text-3xl font-bold tracking-tight text-mauve-900">
          {h.finalCta.title}
        </h2>
        <p className="mt-2 text-mauve-600">{h.finalCta.subtitle}</p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#schedule" className="btn-primary w-full sm:w-auto">
            {h.finalCta.primary}
          </a>
          {!loggedIn && (
            <Link href={`${base}/login`} className="btn-secondary w-full sm:w-auto">
              {h.finalCta.secondary}
            </Link>
          )}
        </div>
        <div className="mt-8 border-t border-mauve-200/70 pt-6 text-sm text-mauve-500">
          <span className="font-medium text-mauve-700">{h.location.title}:</span>{" "}
          {h.location.city} · {h.location.hoursLabel}: {h.location.hours}
        </div>
      </section>
    </div>
  );
}
