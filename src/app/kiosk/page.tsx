import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import type { Locale } from "@/lib/constants";
import { KioskScanner } from "@/components/kiosk/KioskScanner";

// Which studio this tablet checks people into is decided by its device token
// (see /api/scan), never by the URL — so this page is identical at both gyms.
// ?lang=ru only changes the interface language; standby alternates RO/RU either
// way so members of both languages are always addressed.
export const dynamic = "force-dynamic";

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const locale = (isLocale(lang ?? "") ? lang : "ro") as Locale;

  return (
    <KioskScanner
      lang={locale}
      ro={getDictionary("ro").kiosk}
      ru={getDictionary("ru").kiosk}
    />
  );
}
