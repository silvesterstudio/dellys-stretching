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
    redirect(`/${locale}/staff`);
  }

  return (
    <div className="container-page safe-x py-8 sm:py-10">
      <LiveRefresh />
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight text-mauve-900">
        {dict.admin.title}
      </h1>
      {children}
    </div>
  );
}
