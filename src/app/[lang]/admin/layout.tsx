import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireAdmin } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/AdminTabs";

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

  try {
    await requireAdmin();
  } catch {
    redirect(`/${locale}/staff`);
  }

  const base = `/${locale}/admin`;
  const tabs = [
    { href: `${base}/dashboard`, label: dict.admin.dashboardTab },
    { href: `${base}/templates`, label: dict.admin.templates },
    { href: `${base}/members`, label: dict.admin.members },
    { href: `${base}/plans`, label: dict.admin.plansTab },
  ];

  return (
    <div className="container-page safe-x py-8 sm:py-10">
      <h1 className="mb-5 font-display text-3xl font-semibold tracking-tight text-mauve-900">
        {dict.admin.title}
      </h1>
      <AdminTabs tabs={tabs} />
      {children}
    </div>
  );
}
