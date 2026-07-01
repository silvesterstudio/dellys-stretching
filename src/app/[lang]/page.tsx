import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { SITE_URL } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getWeekRange } from "@/lib/week";
import { weekdayInTz } from "@/lib/format";
import { localized } from "@/lib/i18n-data";
import { fetchSessions } from "@/lib/queries";
import { getCurrentUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import { Footer } from "@/components/Footer";
import { DC, tint } from "@/lib/dc";

export const dynamic = "force-dynamic";

type TeaserPlan = {
  id: string;
  name_ro: string;
  name_ru: string;
  price: number;
  currency: string;
  session_count: number;
  validity_days: number;
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
    alternates: { canonical: path, languages: { ro: "/ro", ru: "/ru", "x-default": "/ro" } },
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

async function fetchTeaserPlans(): Promise<TeaserPlan[]> {
  if (!isSupabaseConfigured()) return [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("membership_plans")
      .select("id, name_ro, name_ru, price, currency, session_count, validity_days, featured")
      .eq("active", true)
      .order("featured", { ascending: false })
      .order("price", { ascending: true });
    return ((data ?? []) as TeaserPlan[]).slice(0, 3);
  } catch {
    return [];
  }
}

// ── shared inline styles (ported from the design) ──
const eyebrow: React.CSSProperties = {
  margin: 0,
  fontFamily: DC.sans,
  fontWeight: 700,
  fontSize: 12,
  letterSpacing: ".16em",
  textTransform: "uppercase",
  color: DC.accent,
};
const h2: React.CSSProperties = {
  margin: "14px 0 0",
  fontFamily: DC.display,
  fontWeight: 600,
  fontSize: "clamp(30px,4vw,44px)",
  lineHeight: 1.06,
  letterSpacing: "-.02em",
  color: DC.ink,
};
const subText: React.CSSProperties = { margin: "14px 0 0", fontSize: 17, lineHeight: 1.6, color: DC.muted };
const sectionPad: React.CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "100px 24px" };
const headWrap: React.CSSProperties = { textAlign: "center", maxWidth: 640, margin: "0 auto 56px" };
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
details.dc-faq>summary{list-style:none;cursor:pointer}
details.dc-faq>summary::-webkit-details-marker{display:none}
.dc-faq-ic{flex:none;width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;background:#F3F2F6;color:#6C6B74;transition:all .25s}
details.dc-faq[open] .dc-faq-ic{background:${DC.accent};color:#fff;transform:rotate(45deg)}
/* Smooth anchor scrolling; offset for the sticky header. */
html{scroll-behavior:smooth;scroll-padding-top:84px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
/* On desktop each section fills the viewport with its content vertically
   centered. No scroll-snap — free, smooth scrolling. */
@media (min-width:1024px){
  .dc-screen{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding-top:40px!important;padding-bottom:40px!important}
  .dc-band-inner{padding-top:24px!important;padding-bottom:24px!important;width:100%}
}
`;

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const dict = getDictionary(locale);
  const h = dict.home;
  const base = `/${locale}`;

  const onSunday = weekdayInTz(new Date().toISOString()) === 0;
  const range = getWeekRange(onSunday ? 1 : 0);
  const days = range.days.slice(0, 6).map((d) => d.toISOString());
  const weekEnd = range.days[6];
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
    <div style={{ fontFamily: DC.sans, color: DC.ink, background: "#fff" }}>
      <style dangerouslySetInnerHTML={{ __html: DC_CSS }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* HERO */}
      <section className="dc-screen" style={{ maxWidth: 1200, margin: "0 auto", padding: "72px 24px 40px", position: "relative" }}>
        <div
          aria-hidden
          style={{
            position: "absolute",
            top: -40,
            right: -40,
            width: 520,
            height: 520,
            borderRadius: "50%",
            background: `radial-gradient(circle at center, ${tint(12)}, transparent 62%)`,
            pointerEvents: "none",
            zIndex: 0,
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
            gap: 52,
            alignItems: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <div>
            <p style={eyebrow}>{h.hero.eyebrow}</p>
            <h1
              style={{
                margin: "18px 0 0",
                fontFamily: DC.display,
                fontWeight: 600,
                fontSize: "clamp(40px,5.4vw,64px)",
                lineHeight: 1.02,
                letterSpacing: "-.025em",
                color: DC.ink,
              }}
            >
              {h.hero.titleA}
              <span style={{ color: DC.accent }}>{h.hero.titleB}</span>
            </h1>
            <p style={{ margin: "22px 0 0", maxWidth: 480, fontSize: 18, lineHeight: 1.62, color: DC.sub }}>
              {h.hero.sub}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 14, marginTop: 32 }}>
              <a href="#program" className="dc-btn" style={btnPrimary}>
                {h.hero.cta1}
              </a>
              <a
                href="#preturi"
                className="dc-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  background: "#fff",
                  color: DC.ink,
                  fontWeight: 700,
                  fontSize: 16,
                  padding: "16px 30px",
                  border: "1px solid #E2E0E6",
                  borderRadius: 999,
                  textDecoration: "none",
                }}
              >
                {h.hero.cta2}
              </a>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 22 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" style={{ color: DC.accent, flex: "none" }} aria-hidden>
                <circle cx="12" cy="12" r="10" fill={tint(14)} />
                <path d="M8 12l2.5 2.5L16 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontSize: 14.5, fontWeight: 600, color: "#4A4954" }}>{h.hero.note}</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 30 }}>
              {h.disciplines.items.map((d) => (
                <span
                  key={d.t}
                  style={{ fontSize: 13, fontWeight: 600, color: DC.muted, background: DC.chip, borderRadius: 999, padding: "8px 15px" }}
                >
                  {d.t}
                </span>
              ))}
            </div>
          </div>

          <div style={{ position: "relative" }}>
            <div
              style={{
                position: "relative",
                height: "clamp(420px,50vw,548px)",
                borderRadius: 28,
                overflow: "hidden",
                background: "#F3F2F6",
              }}
            >
              <PhotoBox style={{ width: "100%", height: "100%" }} />
            </div>
            <div
              style={{
                position: "absolute",
                left: -14,
                bottom: -16,
                display: "flex",
                alignItems: "center",
                gap: 13,
                background: "#fff",
                border: `1px solid ${DC.border2}`,
                borderRadius: 18,
                padding: "15px 20px",
                boxShadow: "0 22px 48px -22px rgba(20,18,26,.32)",
              }}
            >
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 12,
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: tint(12),
                  color: DC.accent,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <div style={{ fontFamily: DC.display, fontWeight: 600, fontSize: 15, color: DC.ink }}>{h.hero.cardTitle}</div>
                <div style={{ fontSize: 12.5, color: DC.muted2, marginTop: 2 }}>{h.hero.cardSub}</div>
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))",
            gap: 24,
            borderTop: `1px solid ${DC.border2}`,
            borderBottom: `1px solid ${DC.border2}`,
            padding: "34px 0",
            marginTop: 44,
          }}
        >
          {h.stats.map((s, i) => (
            <div key={s.l}>
              <div
                style={{
                  fontFamily: DC.display,
                  fontWeight: 600,
                  fontSize: 34,
                  letterSpacing: "-.02em",
                  color: i === 2 ? DC.accent : DC.ink,
                }}
              >
                {s.n}
              </div>
              <div style={{ fontSize: 14, color: DC.muted2, marginTop: 4 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DISCIPLINES */}
      <section id="discipline" className="dc-screen" style={{ ...sectionPad, scrollMarginTop: 88 }}>
        <div style={headWrap}>
          <p style={eyebrow}>{h.disciplines.eyebrow}</p>
          <h2 style={h2}>{h.disciplines.title}</h2>
          <p style={subText}>{h.disciplines.sub}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(232px,1fr))", gap: 20 }}>
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
      <section className="dc-screen" style={{ background: DC.band, borderTop: `1px solid ${DC.bandBorder}`, borderBottom: `1px solid ${DC.bandBorder}` }}>
        <div className="dc-band-inner" style={sectionPad}>
          <div style={headWrap}>
            <p style={eyebrow}>{h.age.eyebrow}</p>
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
      <section className="dc-screen" style={{ maxWidth: 1120, margin: "0 auto", padding: "100px 24px" }}>
        <div style={headWrap}>
          <p style={eyebrow}>{h.steps.eyebrow}</p>
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
      <section className="dc-screen" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 100px" }}>
        <div style={{ background: tint(6), border: `1px solid ${tint(16)}`, borderRadius: 28, padding: "clamp(32px,5vw,64px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 44, alignItems: "center" }}>
            <div>
              <p style={eyebrow}>{h.offer.eyebrow}</p>
              <h2 style={{ ...h2, fontSize: "clamp(28px,3.6vw,40px)", lineHeight: 1.08 }}>{h.offer.title}</h2>
              <p style={{ margin: "16px 0 0", maxWidth: 440, fontSize: 16, lineHeight: 1.62, color: DC.sub }}>{h.offer.sub}</p>
              <Link href={loggedIn ? "#program" : `${base}/login?mode=signup`} className="dc-btn" style={{ ...btnPrimary, marginTop: 26 }}>
                {h.offer.cta}
              </Link>
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
      <section id="program" className="dc-screen" style={{ scrollMarginTop: 88, background: DC.band, borderTop: `1px solid ${DC.bandBorder}`, borderBottom: `1px solid ${DC.bandBorder}` }}>
        <div className="dc-band-inner" style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 24px" }}>
          <div style={{ textAlign: "center", maxWidth: 660, margin: "0 auto 40px" }}>
            <p style={eyebrow}>{h.prog.eyebrow}</p>
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
      {plans.length > 0 && (
        <section id="preturi" className="dc-screen" style={{ scrollMarginTop: 88, maxWidth: 1160, margin: "0 auto", padding: "100px 24px" }}>
          <div style={headWrap}>
            <p style={eyebrow}>{h.price.eyebrow}</p>
            <h2 style={h2}>{h.price.title}</h2>
            <p style={subText}>{h.price.sub}</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 22, alignItems: "start" }}>
            {plans.map((p, i) => {
              const feat = i === 0 && p.featured;
              const name = localized(p, "name", locale);
              const meta = `${p.validity_days} ${dict.memberships.days}`;
              const foot = `${p.session_count} ${h.price.sessions}`;
              if (feat) {
                return (
                  <div
                    key={p.id}
                    style={{
                      position: "relative",
                      background: DC.accent,
                      borderRadius: DC.radius,
                      padding: "34px 30px",
                      boxShadow: `0 30px 60px -30px ${tint(70)}`,
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        top: -13,
                        left: "50%",
                        transform: "translateX(-50%)",
                        whiteSpace: "nowrap",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        color: DC.accent,
                        background: "#fff",
                        borderRadius: 999,
                        padding: "7px 16px",
                        boxShadow: "0 6px 16px -8px rgba(20,18,26,.4)",
                      }}
                    >
                      {h.price.best}
                    </span>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#fff" }}>{name}</div>
                    <div style={{ fontSize: 13.5, color: tint(78) }}>{meta}</div>
                    <div style={{ margin: "18px 0 0", display: "flex", alignItems: "baseline", gap: 8 }}>
                      <span style={{ fontFamily: DC.display, fontWeight: 600, fontSize: 46, letterSpacing: "-.02em", color: "#fff" }}>{p.price}</span>
                      <span style={{ fontSize: 16, fontWeight: 600, color: tint(82) }}>{p.currency}</span>
                    </div>
                    <div style={{ height: 1, background: "color-mix(in srgb,#fff 28%,transparent)", margin: "22px 0" }} />
                    <div style={{ fontSize: 14, color: tint(86) }}>{foot}</div>
                    <Link href={`${base}/memberships`} className="dc-btn" style={{ display: "block", textAlign: "center", marginTop: 24, background: "#fff", color: DC.accent, fontWeight: 700, fontSize: 15, padding: 14, borderRadius: 999, textDecoration: "none" }}>
                      {h.price.choose}
                    </Link>
                  </div>
                );
              }
              return (
                <div
                  key={p.id}
                  className="dc-lift"
                  style={{ background: "#fff", border: `1px solid ${DC.border}`, borderRadius: DC.radius, padding: "34px 30px" }}
                >
                  <div style={{ fontSize: 15, fontWeight: 600, color: DC.ink }}>{name}</div>
                  <div style={{ fontSize: 13.5, color: DC.faint }}>{meta}</div>
                  <div style={{ margin: "18px 0 0", display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ fontFamily: DC.display, fontWeight: 600, fontSize: 46, letterSpacing: "-.02em", color: DC.accent }}>{p.price}</span>
                    <span style={{ fontSize: 16, fontWeight: 600, color: DC.faint }}>{p.currency}</span>
                  </div>
                  <div style={{ height: 1, background: DC.border2, margin: "22px 0" }} />
                  <div style={{ fontSize: 14, color: DC.muted }}>{foot}</div>
                  <Link href={`${base}/memberships`} className="dc-btn" style={{ display: "block", textAlign: "center", marginTop: 24, background: "#fff", color: DC.ink, fontWeight: 700, fontSize: 15, padding: 14, border: "1px solid #E2E0E6", borderRadius: 999, textDecoration: "none" }}>
                    {h.price.choose}
                  </Link>
                </div>
              );
            })}
          </div>
          <div style={{ textAlign: "center", marginTop: 34 }}>
            <Link href={`${base}/memberships`} className="dc-link" style={{ fontWeight: 700, fontSize: 15, color: DC.accent, textDecoration: "none" }}>
              {h.price.all} <span aria-hidden>→</span>
            </Link>
          </div>
        </section>
      )}

      {/* FAQ */}
      <section id="faq" className="dc-screen" style={{ scrollMarginTop: 88, maxWidth: 760, margin: "0 auto", padding: "40px 24px 100px" }}>
        <div style={{ textAlign: "center", margin: "0 auto 48px" }}>
          <p style={eyebrow}>{h.faq.eyebrow}</p>
          <h2 style={h2}>{h.faq.title}</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {h.faq.items.map((it) => (
            <details key={it.q} className="dc-faq" style={{ border: `1px solid ${DC.border}`, borderRadius: 16, overflow: "hidden", background: "#fff" }}>
              <summary style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 22px" }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: DC.ink }}>{it.q}</span>
                <span className="dc-faq-ic">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <p style={{ margin: 0, padding: "0 22px 22px", fontSize: 15, lineHeight: 1.62, color: DC.muted }}>{it.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* DARK CTA */}
      <section className="dc-screen" style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px 100px" }}>
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
