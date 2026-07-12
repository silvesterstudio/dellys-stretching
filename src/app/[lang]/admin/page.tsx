import { redirect } from "next/navigation";
import { isLocale } from "@/i18n/config";
import type { Locale } from "@/lib/constants";
import { getCurrentProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

// The standalone "Sessions" tab was removed — session management now lives in
// the weekly schedule editor. Admins land on the dashboard; reception and
// restricted admins (no dashboard access) land on Today.
export default async function AdminIndexPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const profile = await getCurrentProfile();
  const canDashboard = profile?.role === "admin" && profile.dashboard_access !== false;
  redirect(`/${locale}/admin/${canDashboard ? "dashboard" : "today"}`);
}
