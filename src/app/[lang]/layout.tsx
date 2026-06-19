import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { LOCALES, type Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentProfile } from "@/lib/auth";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Dellys",
  description: "Rezervă-ți locul la următoarea sesiune.",
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
    <html lang={locale}>
      <body>
        <Header lang={locale} dict={dict} profile={profile} />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-10 text-center text-xs text-mauve-400">
          © {dict.brand}
        </footer>
      </body>
    </html>
  );
}
