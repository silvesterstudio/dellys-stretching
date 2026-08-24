import type { Metadata } from "next";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { SITE_URL } from "@/lib/constants";
import { isLocale, localePath, languageAlternates } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { fetchLocations } from "@/lib/locations-server";
import { localizedAddress } from "@/lib/locations";
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
  const path = "/";
  return {
    title: dict.home.meta.title,
    description: dict.home.meta.description,
    keywords:
      locale === "ru"
        ? ["расписание", "запись", "фитнес Кишинёв", "пилатес", "стретчинг", "Fit Ball", "Dellys"]
        : ["program", "rezervare", "fitness Chișinău", "pilates", "stretching", "Fit Ball", "Dellys"],
    alternates: { canonical: localePath(locale, path), languages: languageAlternates(path) },
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

const CSS = `
.dc-btn{transition:transform .15s,box-shadow .25s}
.dc-btn:hover{transform:translateY(-2px)}
.dc-lift{transition:transform .2s,box-shadow .25s,border-color .2s}
.dc-lift:hover{transform:translateY(-4px);box-shadow:0 22px 48px -28px rgba(20,18,26,.3);border-color:#E3E1E7}
.loc-card:hover .loc-cta{background:${DC.accent};color:#fff}
`;

// The site root is the studio chooser. The two gyms run entirely separate
// timetables and price lists, so making the visitor pick one up front is what
// makes every page after this unambiguous — rather than showing a mixed
// schedule and hoping they notice a filter.
export default async function ChooseLocationPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const dict = getDictionary(locale);
  const c = dict.home.choose;

  const locations = await fetchLocations();

  return (
    <div style={{ fontFamily: DC.sans, color: DC.ink, background: "#fff", minHeight: "70vh" }}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <section
        style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px 12px", textAlign: "center" }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily: DC.display,
            fontWeight: 600,
            fontSize: "clamp(34px,5vw,52px)",
            lineHeight: 1.06,
            letterSpacing: "-.02em",
            color: DC.ink,
          }}
        >
          {c.title}
        </h1>
        <p
          style={{
            margin: "14px auto 0",
            maxWidth: 560,
            fontSize: 17,
            lineHeight: 1.6,
            color: DC.muted,
          }}
        >
          {c.sub}
        </p>
      </section>

      <section style={{ maxWidth: 1000, margin: "0 auto", padding: "36px 24px 72px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))",
            gap: 20,
          }}
        >
          {locations.map((l) => (
            <Link
              key={l.id}
              href={`/program?loc=${encodeURIComponent(l.key)}`}
              className="dc-lift loc-card"
              style={{
                display: "flex",
                flexDirection: "column",
                background: "#fff",
                border: `1px solid ${DC.border}`,
                borderRadius: DC.radius,
                padding: 28,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  background: tint(8),
                  color: DC.accent,
                  marginBottom: 18,
                }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path
                    d="M21 10c0 6-9 12-9 12S3 16 3 10a9 9 0 1118 0z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>

              <span
                style={{
                  fontFamily: DC.display,
                  fontWeight: 600,
                  fontSize: 25,
                  letterSpacing: "-.01em",
                  color: DC.ink,
                }}
              >
                {l.name}
              </span>
              <span style={{ marginTop: 8, fontSize: 15.5, lineHeight: 1.55, color: DC.muted }}>
                {localizedAddress(l, locale)}
              </span>

              <span
                className="loc-cta dc-btn"
                style={{
                  marginTop: 24,
                  alignSelf: "flex-start",
                  padding: "11px 22px",
                  borderRadius: 999,
                  border: `1px solid ${DC.accent}`,
                  color: DC.accent,
                  background: "transparent",
                  fontWeight: 700,
                  fontSize: 14.5,
                  transition: "background .2s,color .2s",
                }}
              >
                {c.cta} →
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Footer lang={locale} dict={dict} />
    </div>
  );
}
