import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { SITE_URL } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getWeekRange } from "@/lib/week";
import { weekdayInTz, formatPrice } from "@/lib/format";
import { localized } from "@/lib/i18n-data";
import { fetchSessions } from "@/lib/queries";
import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import { PhotoSlot } from "@/components/home/PhotoSlot";
import {
  CheckIcon,
  DISCIPLINE_ICONS,
  BENEFIT_ICONS,
} from "@/components/home/HomeIcons";

export const dynamic = "force-dynamic";

type TeaserPlan = {
  id: string;
  name_ro: string;
  name_ru: string;
  price: number;
  currency: string;
  session_count: number;
  featured: boolean;
};

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
    },
    twitter: {
      card: "summary_large_image",
      title: dict.home.meta.title,
      description: dict.home.meta.description,
    },
  };
}

function SectionHead({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      {eyebrow && <p className="eyebrow-brand mb-3">{eyebrow}</p>}
      <h2 className="font-display text-3xl font-bold -tracking-[0.02em] text-mauve-900 sm:text-[2.5rem] sm:leading-[1.1]">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-mauve-500">{subtitle}</p>}
    </div>
  );
}

async function fetchTeaserPlans(): Promise<TeaserPlan[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("membership_plans")
      .select("id, name_ro, name_ru, price, currency, session_count, featured")
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("price", { ascending: true });
    return ((data ?? []) as TeaserPlan[]).slice(0, 3);
  } catch {
    return [];
  }
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

  const onSunday = weekdayInTz(new Date().toISOString()) === 0;
  const range = getWeekRange(onSunday ? 1 : 0);
  const days = range.days.slice(0, 6).map((d) => d.toISOString());
  const weekEnd = range.days[6];
  const startISO = range.start.toISOString();
  const endISO = weekEnd.toISOString();

  const [sessions, userId, plans] = await Promise.all([
    fetchSessions(range.start, weekEnd),
    getCurrentUserId(),
    fetchTeaserPlans(),
  ]);
  const loggedIn = !!userId;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SportsActivityLocation",
      name: dict.brand,
      description: h.meta.description,
      url: `${SITE_URL}${base}`,
      image: `${SITE_URL}/dellys-logo.webp`,
      address: { "@type": "PostalAddress", addressLocality: "Chișinău", addressCountry: "MD" },
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
    <div className="space-y-24 sm:space-y-32">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="pt-1 sm:pt-4">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* message */}
          <div className="animate-rise text-center lg:text-left">
            <p className="eyebrow">{h.hero.eyebrow}</p>
            <h1 className="mx-auto mt-4 max-w-xl font-display text-[2.6rem] font-bold leading-[1.05] -tracking-[0.03em] text-mauve-900 sm:text-[3.25rem] lg:mx-0 lg:text-[3.75rem]">
              {h.hero.title} <span className="text-brand-500">{h.hero.titleAccent}</span>
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-lg leading-relaxed text-mauve-600 lg:mx-0">
              {h.hero.subtitle}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
              <a href="#schedule" className="btn-primary px-7 py-3 text-base">
                {h.hero.ctaPrimary}
              </a>
              <a href="#plans" className="btn-secondary px-7 py-3 text-base">
                {h.hero.ctaSecondary}
              </a>
            </div>
            <p className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-mauve-600">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-50 text-brand-600">
                <CheckIcon className="h-3.5 w-3.5" />
              </span>
              {h.hero.trust}
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
              {h.disciplines.items.map((d) => (
                <li key={d.title} className="chip">
                  {d.title}
                </li>
              ))}
            </ul>
          </div>

          {/* portrait photo + floating badge */}
          <div className="animate-rise relative mx-auto w-full max-w-md lg:max-w-none">
            <PhotoSlot alt={dict.brand} className="aspect-[4/5] w-full ring-1 ring-mauve-200/60" />
            <div className="absolute -bottom-4 left-4 right-8 flex items-center gap-3 rounded-2xl border border-mauve-100 bg-white/95 p-3 shadow-lg backdrop-blur sm:left-6 sm:right-auto">
              <span className="icon-tile h-9 w-9 rounded-lg">
                <CheckIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-mauve-900">{h.categories.freeBadge}</div>
                <div className="text-xs text-mauve-500">{h.hero.badgeSub}</div>
              </div>
            </div>
          </div>
        </div>

        {/* stats */}
        <dl className="mt-16 grid grid-cols-2 gap-y-8 border-t border-mauve-100 pt-10 sm:grid-cols-4 sm:gap-y-0">
          {h.stats.items.map((s, i) => (
            <div key={s.label} className="text-center sm:text-left">
              <dd
                className={`font-display text-3xl font-bold -tracking-[0.02em] ${
                  i === 2 ? "text-brand-500" : "text-mauve-900"
                }`}
              >
                {s.value}
              </dd>
              <dt className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-mauve-400">
                {s.label}
              </dt>
            </div>
          ))}
        </dl>
      </section>

      {/* Disciplines */}
      <section>
        <SectionHead
          eyebrow={h.disciplines.eyebrow}
          title={h.disciplines.title}
          subtitle={h.disciplines.subtitle}
        />
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {h.disciplines.items.map((d, i) => {
            const Icon = DISCIPLINE_ICONS[i] ?? DISCIPLINE_ICONS[0];
            return (
              <div key={d.title} className="card card-hover flex flex-col p-6">
                <span className="icon-tile">
                  <Icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-bold -tracking-[0.01em] text-mauve-900">
                  {d.title}
                </h3>
                <p className="mt-2.5 text-sm leading-relaxed text-mauve-600">{d.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Age categories — on a soft lavender panel */}
      <section className="rounded-[2rem] bg-mauve-50 px-5 py-14 sm:px-10 sm:py-16">
        <SectionHead
          eyebrow={h.categories.eyebrow}
          title={h.categories.title}
          subtitle={h.categories.subtitle}
        />
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {h.categories.items.map((c) => (
            <div key={c.title} className="card flex flex-col overflow-hidden">
              <PhotoSlot alt={c.title} className="aspect-[16/10] w-full rounded-b-none" />
              <div className="flex flex-1 flex-col p-6">
                <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  <CheckIcon className="h-3.5 w-3.5" />
                  {h.categories.freeBadge}
                </span>
                <h3 className="mt-4 font-display text-xl font-bold -tracking-[0.01em] text-mauve-900">
                  {c.title}
                </h3>
                <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.1em] text-mauve-400">
                  {c.tag}
                </p>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-mauve-600">{c.desc}</p>
                <a
                  href="#schedule"
                  className="mt-5 inline-flex items-center gap-1 self-start text-sm font-semibold text-brand-600 transition-colors hover:text-brand-700"
                >
                  {h.categories.cta}
                  <span aria-hidden>→</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section>
        <SectionHead eyebrow={h.steps.eyebrow} title={h.steps.title} />
        <ol className="mt-12 grid grid-cols-1 gap-8 sm:grid-cols-3">
          {h.steps.items.map((s, i) => (
            <li key={s.title} className="relative">
              <span className="font-display text-5xl font-bold -tracking-[0.03em] text-brand-200">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 font-display text-xl font-bold text-mauve-900">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-mauve-600">{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Offer band — free trial + benefits (2×2) */}
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-sand-100 via-sand-50 to-brand-50 px-6 py-14 sm:px-12 sm:py-16">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="eyebrow-brand">{h.trial.eyebrow}</p>
            <h2 className="mt-3 font-display text-3xl font-bold -tracking-[0.02em] text-mauve-900 sm:text-[2.5rem] sm:leading-[1.1]">
              {h.trial.title}
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-mauve-600">{h.trial.desc}</p>
            <Link
              href={loggedIn ? "#schedule" : `${base}/login?mode=signup`}
              className="btn-primary mt-8 px-7 py-3 text-base"
            >
              {h.trial.cta}
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2">
            {h.benefits.items.map((b, i) => {
              const Icon = BENEFIT_ICONS[i] ?? BENEFIT_ICONS[0];
              return (
                <div key={b.title} className="flex gap-3.5">
                  <span className="icon-tile shrink-0 bg-white/80">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-mauve-900">{b.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-mauve-600">{b.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Program — live schedule (booking system) */}
      <section id="schedule" className="scroll-mt-24">
        <SectionHead
          eyebrow={h.scheduleSection.eyebrow}
          title={h.scheduleSection.title}
          subtitle={h.scheduleSection.subtitle}
        />
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

      {/* Prices — membership teaser (real plans) */}
      {plans.length > 0 && (
        <section id="plans" className="scroll-mt-24">
          <SectionHead eyebrow={h.plans.eyebrow} title={h.plans.title} subtitle={h.plans.subtitle} />
          <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {plans.map((p) => (
              <div
                key={p.id}
                className={`card flex flex-col p-6 ${p.featured ? "ring-2 ring-brand-400" : ""}`}
              >
                {p.featured && (
                  <span className="mb-3 self-start rounded-full bg-brand-600 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    ★ {dict.memberships.featured}
                  </span>
                )}
                <h3 className="font-display text-lg font-bold text-mauve-900">
                  {localized(p, "name", locale)}
                </h3>
                <div className="mt-2 font-display text-3xl font-bold -tracking-[0.02em] text-brand-600">
                  {formatPrice(p.price, p.currency, locale)}
                </div>
                <p className="mt-1 text-sm text-mauve-500">
                  {p.session_count} {h.plans.sessions}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href={`${base}/memberships`} className="btn-secondary px-7 py-3 text-base">
              {h.plans.cta}
            </Link>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24">
        <SectionHead eyebrow={h.faq.eyebrow} title={h.faq.title} />
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
      <section className="overflow-hidden rounded-[2rem] bg-mauve-900 px-6 py-14 text-center sm:px-12 sm:py-16">
        <h2 className="font-display text-3xl font-bold -tracking-[0.02em] text-white sm:text-[2.5rem] sm:leading-[1.1]">
          {h.finalCta.title}
        </h2>
        <p className="mt-3 text-mauve-300">{h.finalCta.subtitle}</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href="#schedule" className="btn-primary w-full px-7 py-3 text-base sm:w-auto">
            {h.finalCta.primary}
          </a>
          {!loggedIn && (
            <Link
              href={`${base}/login`}
              className="btn w-full border border-white/25 bg-white/5 text-white hover:bg-white/10 sm:w-auto px-7 py-3 text-base"
            >
              {h.finalCta.secondary}
            </Link>
          )}
        </div>
        <div className="mt-10 text-sm text-mauve-400">
          <span className="font-semibold text-mauve-200">{h.location.title}:</span>{" "}
          {h.location.city} · {h.location.hoursLabel}: {h.location.hours}
        </div>
      </section>
    </div>
  );
}
