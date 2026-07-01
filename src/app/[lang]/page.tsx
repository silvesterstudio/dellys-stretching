import type { Metadata } from "next";
import Link from "next/link";
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

function CheckIcon({ className = "h-4 w-4 text-brand-600" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden className={className}>
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

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="font-display text-3xl font-bold -tracking-[0.02em] text-mauve-900 sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-mauve-500">{subtitle}</p>}
    </div>
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
    <div className="space-y-24 sm:space-y-36">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="relative isolate pt-4 text-center sm:pt-10">
        {/* Single signature accent: a soft pink glow behind the headline. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[-3rem] -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl"
        />
        <p className="eyebrow animate-rise">{h.hero.eyebrow}</p>
        <h1 className="animate-rise mx-auto mt-5 max-w-4xl font-display text-[2.75rem] font-bold leading-[1.04] -tracking-[0.025em] text-mauve-900 sm:text-6xl lg:text-7xl">
          {h.hero.title}{" "}
          <span className="text-brand-500">{h.hero.titleAccent}</span>
        </h1>
        <p className="animate-rise mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-mauve-600">
          {h.hero.subtitle}
        </p>
        <div className="animate-rise mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#schedule" className="btn-primary w-full px-7 py-3 text-base sm:w-auto">
            {h.hero.ctaPrimary}
          </a>
          <Link href={`${base}/memberships`} className="btn-secondary w-full px-7 py-3 text-base sm:w-auto">
            {h.hero.ctaSecondary}
          </Link>
        </div>
        <p className="mt-6 inline-flex items-center gap-2 text-sm text-mauve-500">
          <CheckIcon />
          {h.hero.trust}
        </p>

        {/* Stats — a quiet hairline-framed row, not heavy cards. */}
        <dl className="mx-auto mt-16 grid max-w-3xl grid-cols-2 gap-y-8 border-y border-mauve-100 py-8 sm:grid-cols-4 sm:gap-y-0">
          {h.stats.items.map((s) => (
            <div key={s.label} className="text-center">
              <dd className="font-display text-3xl font-bold -tracking-[0.02em] text-mauve-900">
                {s.value}
              </dd>
              <dt className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.15em] text-mauve-400">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </section>

      {/* Categories */}
      <section>
        <SectionHead title={h.categories.title} subtitle={h.categories.subtitle} />
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {h.categories.items.map((c) => (
            <div key={c.title} className="card card-hover flex flex-col p-7">
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                <CheckIcon className="h-3.5 w-3.5 text-brand-600" />
                {h.categories.freeBadge}
              </span>
              <h3 className="mt-5 font-display text-xl font-bold -tracking-[0.01em] text-mauve-900">
                {c.title}
              </h3>
              <p className="mt-2.5 flex-1 text-sm leading-relaxed text-mauve-600">{c.desc}</p>
              <a
                href="#schedule"
                className="mt-5 inline-flex items-center gap-1 self-start text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
              >
                {h.categories.cta}
                <span aria-hidden>→</span>
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section>
        <SectionHead title={h.benefits.title} />
        <div className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {h.benefits.items.map((b) => (
            <div key={b.title}>
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50">
                <CheckIcon className="h-5 w-5 text-brand-600" />
              </span>
              <h3 className="mt-5 text-base font-semibold text-mauve-900">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mauve-600">{b.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works — a real 3-step sequence, so numbering carries meaning. */}
      <section>
        <SectionHead title={h.steps.title} subtitle={h.steps.subtitle} />
        <ol className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {h.steps.items.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="font-display text-5xl font-bold -tracking-[0.03em] text-brand-500/90">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 font-display text-xl font-bold text-mauve-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mauve-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Free-trial band */}
      <section className="card overflow-hidden bg-sand-50 px-6 py-14 text-center sm:px-12 sm:py-16">
        <p className="eyebrow">{h.trial.eyebrow}</p>
        <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-bold -tracking-[0.02em] text-mauve-900 sm:text-4xl">
          {h.trial.title}
        </h2>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-mauve-600">{h.trial.desc}</p>
        <Link
          href={loggedIn ? "#schedule" : `${base}/login?mode=signup`}
          className="btn-primary mt-8 px-7 py-3 text-base"
        >
          {h.trial.cta}
        </Link>
      </section>

      {/* Live schedule — connects to the booking system */}
      <section id="schedule" className="scroll-mt-24">
        <SectionHead title={h.scheduleSection.title} subtitle={h.scheduleSection.subtitle} />
        <div className="mx-auto mt-4 h-0.5 w-10 rounded-full bg-brand-500" />
        <div className="mt-10">
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
        <SectionHead title={h.faq.title} />
        <div className="mx-auto mt-10 max-w-2xl divide-y divide-mauve-100 border-y border-mauve-100">
          {h.faq.items.map((it) => (
            <details key={it.q} className="group py-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[15px] font-semibold text-mauve-900">
                {it.q}
                <span className="text-2xl font-light leading-none text-brand-500 transition-transform duration-200 group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-mauve-600">{it.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA + location */}
      <section className="card relative isolate overflow-hidden bg-sand-50 px-6 py-14 text-center sm:px-12 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute right-[-4rem] top-[-4rem] -z-10 h-64 w-64 rounded-full bg-brand-200/40 blur-3xl"
        />
        <h2 className="font-display text-3xl font-bold -tracking-[0.02em] text-mauve-900 sm:text-4xl">
          {h.finalCta.title}
        </h2>
        <p className="mt-3 text-mauve-600">{h.finalCta.subtitle}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#schedule" className="btn-primary w-full px-7 py-3 text-base sm:w-auto">
            {h.finalCta.primary}
          </a>
          {!loggedIn && (
            <Link href={`${base}/login`} className="btn-secondary w-full px-7 py-3 text-base sm:w-auto">
              {h.finalCta.secondary}
            </Link>
          )}
        </div>
        <div className="mt-10 text-sm text-mauve-500">
          <span className="font-semibold text-mauve-700">{h.location.title}:</span>{" "}
          {h.location.city} · {h.location.hoursLabel}: {h.location.hours}
        </div>
      </section>
    </div>
  );
}
