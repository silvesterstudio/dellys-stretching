import type { Metadata } from "next";
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
import { PricingTeaser } from "@/components/PricingTeaser";
import { Footer } from "@/components/Footer";
import { DC, tint } from "@/lib/dc";

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
  const path = `/${locale}/landing`;
  return {
    title: dict.home.meta.title,
    description: dict.home.meta.description,
    keywords:
      locale === "ru"
        ? ["фитнес Кишинёв", "пилатес", "стретчинг", "гимнастика", "Fit Ball", "детская гимнастика", "Dellys"]
        : ["fitness Chișinău", "pilates", "stretching", "gimnastică", "Fit Ball", "gimnastică copii", "Dellys"],
    alternates: {
      canonical: path,
      languages: { ro: "/ro/landing", ru: "/ru/landing", "x-default": "/ro/landing" },
    },
    openGraph: {
      type: "website",
      url: `${SITE_URL}${path}`,
      siteName: dict.brand,
      locale: locale === "ru" ? "ru_RU" : "ro_RO",
      title: dict.home.meta.title,
      description: dict.home.meta.description,
    },
    twitter: { card: "summary_large_image", title: dict.home.meta.title, description: dict.home.meta.description },
  };
}

// ── shared inline styles (ported from the design) ──
const HERO_BG = "#100D14";
const h2: React.CSSProperties = {
  margin: 0,
  fontFamily: DC.display,
  fontWeight: 600,
  fontSize: "clamp(30px,4vw,44px)",
  lineHeight: 1.06,
  letterSpacing: "-.02em",
  color: DC.ink,
};
const subText: React.CSSProperties = { margin: "14px 0 0", fontSize: 17, lineHeight: 1.6, color: DC.muted };
const sectionPad: React.CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "64px 24px" };
const headWrap: React.CSSProperties = { textAlign: "center", maxWidth: 640, margin: "0 auto 44px" };
const btnPrimary: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: DC.accent,
  color: "#fff",
  fontWeight: 700,
  fontSize: 16,
  padding: "16px 30px",
  borderRadius: 999,
  textDecoration: "none",
};

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}
const DISC_ICONS = [
  <Icon key="p"><path d="M12 3v18M7 8c3 2 7 2 10 0M7 16c3-2 7-2 10 0" /></Icon>,
  <Icon key="s"><path d="M4 12h16M9 7l-5 5 5 5M15 7l5 5-5 5" /></Icon>,
  <Icon key="g"><path d="M12 3v18M3 12h18M6 6l12 12M18 6L6 18" /></Icon>,
  <Icon key="f"><circle cx="12" cy="13" r="7" /><path d="M5.4 10.4c4.2 2.1 9 2.1 13.2 0M12 6v14" /></Icon>,
  <Icon key="pp"><circle cx="12" cy="14.5" r="5.5" /><path d="M8.5 10.5V8a3.5 3.5 0 017 0v2.5" /></Icon>,
  <Icon key="tb"><path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" /></Icon>,
];
function BIcon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}
const BEN_ICONS = [
  <BIcon key="g"><path d="M9 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 2.7-5 6-5s6 2 6 5" /><path d="M16 5.6a3 3 0 011 5.8M21 20c0-2.4-1.4-4.2-3.6-4.8" /></BIcon>,
  <BIcon key="c"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></BIcon>,
  <BIcon key="t"><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M3 10h18" /></BIcon>,
  <BIcon key="k"><path d="M20 6L9 17l-5-5" /></BIcon>,
];

function PhotoBox({ style }: { style?: React.CSSProperties }) {
  return (
    <div style={{ background: "#F3F2F6", display: "grid", placeItems: "center", ...style }}>
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#C9C7CF" strokeWidth="1.4" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="8.5" cy="9.5" r="1.6" />
        <path d="M21 16l-5-5-6 6-3-3-4 4" />
      </svg>
    </div>
  );
}

const DC_CSS = `
.dc-btn{transition:transform .15s,box-shadow .25s}
.dc-btn:hover{transform:translateY(-2px)}
.dc-lift{transition:transform .2s,box-shadow .25s,border-color .2s}
.dc-lift:hover{transform:translateY(-4px);box-shadow:0 22px 48px -28px rgba(20,18,26,.3);border-color:#E3E1E7}
.dc-link{transition:color .2s}
.dc-hero{min-height:100vh;min-height:100svh}
html{scroll-behavior:smooth;scroll-padding-top:92px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

export default async function LandingPage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const dict = getDictionary(locale);
  const h = dict.home;
  const base = `/${locale}`;

  const onSunday = weekdayInTz(new Date().toISOString()) === 0;
  const range = getWeekRange(onSunday ? 1 : 0);
  const days = range.days.slice(0, 6).map((d) => d.toISOString());
  const weekEnd = range.days[6];
  const [sessions, userId] = await Promise.all([
    fetchSessions(range.start, weekEnd),
    getCurrentUserId(),
  ]);
  const loggedIn = !!userId;

  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SportsActivityLocation",
      name: dict.brand,
      description: h.meta.description,
      url: `${SITE_URL}${base}/landing`,
      image: `${SITE_URL}/dellys-logo.webp`,
      address: {
        "@type": "PostalAddress",
        streetAddress: "str. Gheorghe Asachi 65",
        addressLocality: "Chișinău",
        addressCountry: "MD",
      },
      telephone: "+373 68 344 333",
      email: "info@caracas.md",
      sameAs: ["https://facebook.com/Caracas.md", "https://instagram.com/caracas.md"],
      areaServed: "Chișinău",
      priceRange: "$$",
      knowsLanguage: ["ro", "ru"],
      sport: ["Pilates", "Stretching", "Gymnastics"],
    },
  ];

  return (
    <div style={{ fontFamily: DC.sans, color: DC.ink, background: "#fff" }}>
      <style dangerouslySetInnerHTML={{ __html: DC_CSS }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO — dark full-bleed studio photo with the header floating over it */}
      <section
        className="dc-hero"
        style={{
          position: "relative",
          marginTop: -76,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          overflow: "hidden",
          background: HERO_BG,
        }}
      >
        <Image
          src="/hero-image-dellys.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover", objectPosition: "center 26%", zIndex: 0 }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background: `linear-gradient(90deg, ${HERO_BG}F2 0%, ${HERO_BG}D9 30%, ${HERO_BG}94 58%, ${HERO_BG}59 100%)`,
          }}
        />
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            background: `linear-gradient(0deg, ${HERO_BG}E6 0%, ${HERO_BG}00 42%)`,
          }}
        />

        <div style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 1200, margin: "0 auto", padding: "104px 24px 64px" }}>
          <div style={{ maxWidth: 640 }}>
            <h1
              style={{
                margin: 0,
                fontFamily: DC.display,
                fontWeight: 600,
                fontSize: "clamp(42px,6vw,74px)",
                lineHeight: 1.02,
                letterSpacing: "-.025em",
                color: "#fff",
              }}
            >
              {h.hero.titleA}
              <span style={{ color: DC.accent }}>{h.hero.titleB}</span>
            </h1>

            <p style={{ margin: "22px 0 0", maxWidth: 520, fontSize: 18, lineHeight: 1.62, color: "rgba(255,255,255,.82)" }}>
              {h.hero.sub}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 34 }}>
              <a href="#program" className="dc-btn" style={btnPrimary}>
                {h.hero.cta1}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* DISCIPLINES */}
      <section id="discipline" className="dc-screen" style={{ ...sectionPad, scrollMarginTop: 88 }}>
        <div style={headWrap}>
          <h2 style={h2}>{h.disciplines.title}</h2>
          <p style={subText}>{h.disciplines.sub}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 20 }}>
          {h.disciplines.items.map((d, i) => (
            <div
              key={d.t}
              className="dc-lift"
              style={{ background: "#fff", border: `1px solid ${DC.border}`, borderRadius: DC.radius, padding: 28 }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 13,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: tint(9),
                  color: DC.accent,
                }}
              >
                {DISC_ICONS[i]}
              </div>
              <h3 style={{ margin: "18px 0 0", fontFamily: DC.display, fontWeight: 600, fontSize: 20, color: DC.ink }}>{d.t}</h3>
              <p style={{ margin: "9px 0 0", fontSize: 14.5, lineHeight: 1.58, color: DC.muted }}>{d.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AGE CATEGORIES */}
      <section className="dc-screen">
        <div className="dc-band-inner" style={sectionPad}>
          <div style={headWrap}>
            <h2 style={h2}>{h.age.title}</h2>
            <p style={subText}>{h.age.sub}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(288px,1fr))", gap: 24 }}>
            {h.age.items.map((a) => (
              <div
                key={a.t}
                className="dc-lift"
                style={{ background: "#fff", border: `1px solid ${DC.border}`, borderRadius: DC.radius, overflow: "hidden" }}
              >
                <PhotoBox style={{ width: "100%", height: 150 }} />
                <div style={{ padding: 26 }}>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: DC.accent,
                      background: tint(10),
                      borderRadius: 999,
                      padding: "6px 12px",
                    }}
                  >
                    {h.age.badge}
                  </span>
                  <h3 style={{ margin: "16px 0 0", fontFamily: DC.display, fontWeight: 600, fontSize: 23, color: DC.ink }}>{a.t}</h3>
                  <div style={{ margin: "6px 0 0", fontSize: 12.5, fontWeight: 600, letterSpacing: ".02em", color: DC.faint }}>{a.tag}</div>
                  <p style={{ margin: "12px 0 0", fontSize: 14.5, lineHeight: 1.58, color: DC.muted }}>{a.d}</p>
                  <a
                    href="#program"
                    className="dc-link"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 18, fontWeight: 700, fontSize: 14.5, color: DC.accent, textDecoration: "none" }}
                  >
                    {h.age.link} <span aria-hidden>→</span>
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="dc-screen" style={{ maxWidth: 1120, margin: "0 auto", padding: "64px 24px" }}>
        <div style={headWrap}>
          <h2 style={h2}>{h.steps.title}</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 20 }}>
          {h.steps.items.map((s, i) => (
            <div key={s.t} style={{ padding: "8px 8px 0" }}>
              <div style={{ fontFamily: DC.display, fontWeight: 500, fontSize: 52, lineHeight: 1, color: tint(24) }}>
                {String(i + 1).padStart(2, "0")}
              </div>
              <h3 style={{ margin: "16px 0 0", fontFamily: DC.display, fontWeight: 600, fontSize: 21, color: DC.ink }}>{s.t}</h3>
              <p style={{ margin: "9px 0 0", fontSize: 15, lineHeight: 1.6, color: DC.muted }}>{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* OFFER + BENEFITS */}
      <section className="dc-screen" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ background: tint(6), border: `1px solid ${tint(16)}`, borderRadius: 28, padding: "clamp(32px,5vw,64px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 44, alignItems: "center" }}>
            <div>
              <h2 style={{ ...h2, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.08 }}>{h.offer.title}</h2>
              <p style={{ margin: "16px 0 0", maxWidth: 440, fontSize: 16, lineHeight: 1.62, color: DC.sub }}>{h.offer.sub}</p>
              <a href="#program" className="dc-btn" style={{ ...btnPrimary, marginTop: 26 }}>
                {h.offer.cta}
              </a>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
              {h.offer.benefits.map((b, i) => (
                <div key={b.t}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#fff",
                      color: DC.accent,
                      boxShadow: "0 4px 14px -6px rgba(20,18,26,.2)",
                    }}
                  >
                    {BEN_ICONS[i]}
                  </div>
                  <h4 style={{ margin: "13px 0 0", fontSize: 16, fontWeight: 700, color: DC.ink }}>{b.t}</h4>
                  <p style={{ margin: "5px 0 0", fontSize: 13.5, lineHeight: 1.5, color: DC.muted }}>{b.d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PROGRAM */}
      <section id="program" className="dc-screen" style={{ scrollMarginTop: 88 }}>
        <div className="dc-band-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "64px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 660, margin: "0 auto 40px" }}>
            <h2 style={h2}>{h.prog.title}</h2>
            <p style={subText}>{h.prog.sub}</p>
          </div>
          <ScheduleGrid
            lang={locale}
            dict={dict}
            days={days}
            initialSessions={sessions}
            weekStartISO={range.start.toISOString()}
            weekEndISO={weekEnd.toISOString()}
            loggedIn={loggedIn}
          />
        </div>
      </section>

      {/* PRICES */}
      <section id="preturi" className="dc-screen" style={{ scrollMarginTop: 88, maxWidth: 1160, margin: "0 auto", padding: "64px 24px" }}>
        <div style={headWrap}>
          <h2 style={h2}>{h.price.title}</h2>
          <p style={subText}>{h.price.sub}</p>
        </div>
        <PricingTeaser dict={dict} />
        <p style={{ textAlign: "center", marginTop: 30, fontSize: 14.5, color: DC.faint }}>
          {h.price.note}
        </p>
      </section>

      {/* DARK CTA */}
      <section className="dc-screen" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 64px" }}>
        <div style={{ position: "relative", overflow: "hidden", background: DC.ink, borderRadius: 28, padding: "clamp(48px,7vw,88px) 32px", textAlign: "center" }}>
          <div aria-hidden style={{ position: "absolute", top: -80, right: -40, width: 360, height: 360, borderRadius: "50%", background: `radial-gradient(circle, ${tint(55)}, transparent 62%)`, pointerEvents: "none" }} />
          <div aria-hidden style={{ position: "absolute", bottom: -100, left: -30, width: 320, height: 320, borderRadius: "50%", background: `radial-gradient(circle, ${tint(34)}, transparent 64%)`, pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <h2 style={{ margin: 0, fontFamily: DC.display, fontWeight: 600, fontSize: "clamp(32px,4.4vw,50px)", lineHeight: 1.05, letterSpacing: "-.02em", color: "#fff" }}>{h.cta.title}</h2>
            <p style={{ margin: "16px auto 0", maxWidth: 440, fontSize: 17, lineHeight: 1.6, color: "#B9B7C0" }}>{h.cta.sub}</p>
            <a href="#program" className="dc-btn" style={{ ...btnPrimary, marginTop: 30, padding: "17px 34px" }}>
              {h.cta.btn}
            </a>
          </div>
        </div>
      </section>

      <Footer lang={locale} dict={dict} />
    </div>
  );
}
