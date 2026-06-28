import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";

export const dynamic = "force-dynamic";

// Admin login now lives only on the main login page (type "admin" as the email
// to reveal the password field). This old route just funnels there.
export default async function StaffPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  redirect(`/${locale}/login`);
}
