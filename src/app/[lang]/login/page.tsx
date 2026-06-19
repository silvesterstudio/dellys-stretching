import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ session?: string }>;
}) {
  const { lang } = await params;
  const { session } = await searchParams;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  // Already signed in — skip straight to the destination.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect(session ? `/${locale}/book/${session}` : `/${locale}/dashboard`);
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold text-mauve-900">
          {dict.auth.title}
        </h1>
        <p className="mt-1 text-sm text-mauve-500">{dict.auth.subtitle}</p>
        <LoginForm lang={locale} dict={dict} nextSession={session ?? null} />
      </div>
    </div>
  );
}
