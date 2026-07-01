import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Montserrat, Manrope } from "next/font/google";
import "../globals.css";
import { LOCALES, SITE_URL, type Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentProfile } from "@/lib/auth";
import { Header } from "@/components/Header";

// Display = Montserrat (geometric, modern, boutique). latin-ext covers Romanian
// diacritics (ă â î ș ț); cyrillic covers Russian.
const display = Montserrat({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

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
        <main className="container-page safe-x py-6 sm:py-10">{children}</main>
      </body>
    </html>
  );
}
