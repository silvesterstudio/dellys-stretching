import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ session?: string; error?: string }>;
}) {
  const { lang } = await params;
  const { session, error } = await searchParams;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  // Already signed in — skip straight to the destination. Guarded so a missing
  // Supabase config or auth outage shows the login form instead of crashing.
  let signedIn = false;
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      signedIn = !!user;
    } catch {
      signedIn = false;
    }
  }
  // redirect() throws internally — keep it outside the try/catch above.
  if (signedIn) {
    redirect(session ? `/${locale}/book/${session}` : `/${locale}/dashboard`);
  }

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="card p-6">
        <h1 className="font-display text-2xl font-bold text-mauve-900">
          {dict.auth.title}
        </h1>
        <p className="mt-1 text-sm text-mauve-500">{dict.auth.subtitle}</p>
        {error && (
          <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
            {dict.auth.linkError}
          </div>
        )}
        <LoginForm lang={locale} dict={dict} nextSession={session ?? null} />
      </div>
    </div>
  );
}
