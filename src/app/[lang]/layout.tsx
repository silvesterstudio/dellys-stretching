import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Space_Grotesk, Manrope } from "next/font/google";
import "../globals.css";
import { LOCALES, SITE_URL, type Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentProfile } from "@/lib/auth";
import { Header } from "@/components/Header";

// Display = Space Grotesk (geometric, modern — from the Dellys mockup). It has
// no Cyrillic, so Russian headings fall back per-glyph to Manrope via the
// Tailwind `display` stack. latin-ext covers Romanian diacritics.
const display = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Body = Manrope (also carries Cyrillic for Russian).
const sans = Manrope({
  subsets: ["latin", "latin-ext", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Dellys — Studio de fitness în Chișinău",
    template: "%s · Dellys",
  },
  description: "Rezervă-ți locul la următoarea sesiune. Pilates, stretching, gimnastică.",
  applicationName: "Dellys",
  icons: { icon: "/dellys-logo.webp", apple: "/dellys-logo.webp" },
};

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  const locale = lang as Locale;
  const dict = getDictionary(locale);
  const profile = await getCurrentProfile();

  return (
    <html lang={locale} className={`${display.variable} ${sans.variable}`}>
      <body className="font-sans">
        <Header lang={locale} dict={dict} profile={profile} />
        {/* No global container: the home page manages its own full-width bands;
            every other page wraps its content in `container-page`. */}
        <main>{children}</main>
      </body>
    </html>
  );
}
