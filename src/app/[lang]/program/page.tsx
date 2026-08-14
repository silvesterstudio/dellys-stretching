import type { Metadata } from "next";
import type { Locale } from "@/lib/constants";
import { SITE_URL } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getWeekRange } from "@/lib/week";
import { fetchSessions } from "@/lib/queries";
import { fetchLocations, resolveLocation } from "@/lib/locations-server";
import { getCurrentUserId, getCurrentProfile } from "@/lib/auth";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import { PricingTeaser } from "@/components/PricingTeaser";
import { Footer } from "@/components/Footer";
import { DC } from "@/lib/dc";

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
  const path = `/${locale}/program`;
  return {
    title: dict.home.meta.title,
    description: dict.home.meta.description,
    keywords:
      locale === "ru"
        ? ["расписание", "запись", "фитнес Кишинёв", "пилатес", "стретчинг", "Fit Ball", "Dellys"]
        : ["program", "rezervare", "fitness Chișinău", "pilates", "stretching", "Fit Ball", "Dellys"],
    alternates: {
      canonical: path,
      languages: { ro: "/ro/program", ru: "/ru/program", "x-default": "/ro/program" },
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

const h2: React.CSSProperties = {
  margin: 0,
  fontFamily: DC.display,
  fontWeight: 600,
  fontSize: "clamp(30px,4vw,44px)",
  lineHeight: 1.06,
  letterSpacing: "-.02em",
  color: DC.ink,
};
const subText: React.CSSProperties = { margin: "12px 0 0", fontSize: 17, lineHeight: 1.6, color: DC.muted };

// Hover/lift helpers used by ScheduleGrid + PricingTeaser, and smooth anchor
// scrolling to the prices section.
const DC_CSS = `
.dc-btn{transition:transform .15s,box-shadow .25s}
.dc-btn:hover{transform:translateY(-2px)}
.dc-lift{transition:transform .2s,box-shadow .25s,border-color .2s}
.dc-lift:hover{transform:translateY(-4px);box-shadow:0 22px 48px -28px rgba(20,18,26,.3);border-color:#E3E1E7}
html{scroll-behavior:smooth;scroll-padding-top:92px}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

// One studio's schedule. The site root is the chooser, so a visitor always
// arrives here having already picked a gym (?loc=key, or the choice remembered
// in a cookie). There is no picker on this page — the grid shows which studio
// this is and links back to the chooser.
export default async function ProgramPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ loc?: string }>;
}) {
  const { lang } = await params;
  const { loc } = await searchParams;
  const locale = resolveLocale(lang);
  const dict = getDictionary(locale);
  const h = dict.home;

  // Two full weeks, Monday through Sunday: the rest of the current week plus
  // the whole next one, so there is always a fortnight of booking runway.
  const range = getWeekRange(0);
  const nextWeek = getWeekRange(1);
  const days = [...range.days, ...nextWeek.days].map((d) => d.toISOString());

  const [locations, userId] = await Promise.all([fetchLocations(), getCurrentUserId()]);
  const loggedIn = !!userId;

  // A signed-in member belongs to one studio and can only book there, so their
  // own gym wins over ?loc= and over the cookie. Otherwise they could sit on
  // the other studio's schedule and every "Rezervă" would fail — and with no
  // picker on this page they would have no way to correct it.
  let home: string | null = null;
  if (userId) {
    const profile = await getCurrentProfile();
    home = profile?.location_id ?? null;
  }
  const active = home
    ? (locations.find((l) => l.id === home) ?? (await resolveLocation(locations, loc ?? null)))
    : await resolveLocation(locations, loc ?? null);

  const sessions = await fetchSessions(range.start, nextWeek.end, active?.id ?? null);

  return (
    <div style={{ fontFamily: DC.sans, color: DC.ink, background: "#fff" }}>
      <style dangerouslySetInnerHTML={{ __html: DC_CSS }} />

      {/* HEADING */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "40px 24px 8px", textAlign: "center" }}>
        <h1 style={{ ...h2, fontSize: "clamp(34px,5vw,52px)" }}>{h.prog.title}</h1>
        <p style={{ ...subText, maxWidth: 620, margin: "12px auto 0" }}>{h.prog.sub}</p>
      </section>

      {/* SCHEDULE — the primary content */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 24px 56px" }}>
        <ScheduleGrid
          lang={locale}
          dict={dict}
          days={days}
          initialSessions={sessions}
          weekStartISO={range.start.toISOString()}
          weekEndISO={nextWeek.end.toISOString()}
          loggedIn={loggedIn}
          locations={locations}
          initialLocationId={active?.id ?? null}
        />
      </section>

      {/* PRICES */}
      <section id="preturi" className="dc-screen" style={{ scrollMarginTop: 92, maxWidth: 1160, margin: "0 auto", padding: "8px 24px 64px" }}>
        <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 40px" }}>
          <h2 style={h2}>{h.price.title}</h2>
          <p style={subText}>{h.price.sub}</p>
        </div>
        <PricingTeaser dict={dict} />
        <p style={{ textAlign: "center", marginTop: 30, fontSize: 14.5, color: DC.faint }}>
          {h.price.note}
        </p>
      </section>

      <Footer lang={locale} dict={dict} />
    </div>
  );
}
