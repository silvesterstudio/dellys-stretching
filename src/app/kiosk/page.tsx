import QRCode from "qrcode";
import { getDictionary } from "@/i18n/get-dictionary";
import { isLocale } from "@/i18n/config";
import { SITE_URL, type Locale } from "@/lib/constants";
import { KioskScanner } from "@/components/kiosk/KioskScanner";

// Which studio this tablet checks people into is decided by its device token
// (see /api/scan), never by the URL — so this page is identical at both gyms.
// ?lang=ru only changes the interface language; standby alternates RO/RU either
// way so members of both languages are always addressed.
export const dynamic = "force-dynamic";

// Where a visitor without an account is sent. Short enough to read off the
// screen and type by hand if the camera is uncooperative.
const SIGNUP_PATH = "/welcome";

export default async function KioskPage({
  searchParams,
}: {
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const locale = (isLocale(lang ?? "") ? lang : "ro") as Locale;

  // Rendered here rather than in the browser: the code arrives ready-made in the
  // payload, so the tablet never has to load a QR library or spend a frame
  // generating an image it will show for hours unchanged. (The standby itself
  // still waits on the device token, which lives in localStorage.)
  //
  // Error correction H so it survives being read off a glossy screen at an
  // angle, across the room, under ceiling light.
  const signupUrl = `${SITE_URL}${SIGNUP_PATH}`;
  const signupQr = await QRCode.toDataURL(signupUrl, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 720,
    color: { dark: "#16151b", light: "#ffffff" },
  });

  return (
    <KioskScanner
      lang={locale}
      ro={getDictionary("ro").kiosk}
      ru={getDictionary("ru").kiosk}
      signupQr={signupQr}
      // Shown under the code as plain text, without the scheme.
      signupLabel={signupUrl.replace(/^https?:\/\//, "")}
    />
  );
}
