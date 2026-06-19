import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { getCurrentProfile } from "@/lib/auth";
import { StaffLoginForm } from "@/components/auth/StaffLoginForm";

export const dynamic = "force-dynamic";

export default async function StaffPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  const profile = await getCurrentProfile();
  if (profile?.role === "admin") redirect(`/${locale}/admin`);

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold text-mauve-900">
          {dict.auth.staffTitle}
        </h1>
        <StaffLoginForm lang={locale} dict={dict} />
      </div>
    </div>
  );
}
