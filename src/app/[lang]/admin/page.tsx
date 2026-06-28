import { redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import type { Locale } from "@/lib/constants";

export const dynamic = "force-dynamic";

// The standalone "Sessions" tab was removed — session management now lives in
// the weekly schedule editor. The admin index lands on the dashboard.
export default async function AdminIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  redirect(`/${locale}/admin/dashboard`);
}
