import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireStaff } from "@/lib/auth";
import { LiveRefresh } from "@/components/admin/LiveRefresh";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  // Admits admins and reception staff; the section nav now lives in the header
  // island (see Header.tsx), so there is no tab row here anymore.
  try {
    await requireStaff();
  } catch {
    redirect("/staff");
  }

  return (
    <div className="admin-shell container-page safe-x py-8 sm:py-10">
      <LiveRefresh />
      {/* No heading here any more — each page prints its own via <PageHead>,
          so a screen says what it is instead of all of them saying the same. */}
      {children}
    </div>
  );
}
