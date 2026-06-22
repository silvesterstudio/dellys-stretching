import { redirect } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireAdmin } from "@/lib/auth";

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
    { href: base, label: dict.admin.sessions },
    { href: `${base}/templates`, label: dict.admin.templates },
    { href: `${base}/members`, label: dict.admin.members },
    { href: `${base}/plans`, label: dict.admin.plansTab },
  ];

  return (
    <div>
      <h1 className="mb-4 font-display text-3xl font-bold text-mauve-900">
        {dict.admin.title}
      </h1>
      <nav className="mb-6 flex flex-wrap gap-2 border-b border-mauve-100 pb-3">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className="btn-secondary">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
