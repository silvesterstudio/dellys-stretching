import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Playfair_Display, Manrope } from "next/font/google";
import "../globals.css";
import { LOCALES, type Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentProfile } from "@/lib/auth";
import { Header } from "@/components/Header";

const display = Playfair_Display({
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dellys — Studio",
  description: "Rezervă-ți locul la următoarea sesiune. Pilates, stretching, gimnastică.",
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
        <footer className="container-page safe-x border-t border-mauve-100/70 py-8 text-center text-xs text-mauve-400">
          <span className="font-display text-sm text-mauve-500">{dict.brand}</span>
          <span className="mx-2">·</span>
          <a href={`/${locale}/staff`} className="hover:text-mauve-600">
            {dict.auth.staffLink}
          </a>
        </footer>
      </body>
    </html>
  );
}
