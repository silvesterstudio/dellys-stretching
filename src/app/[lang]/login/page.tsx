import { redirect } from "next/navigation";
import Image from "next/image";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ session?: string; error?: string; mode?: string }>;
}) {
  const { lang } = await params;
  const { session, error, mode } = await searchParams;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);
  const isSignup = mode === "signup";
  const sessionQ = session ? `?session=${session}` : "";

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
    <div className="mx-auto max-w-md py-10 sm:py-16">
      <div className="card p-7 sm:p-8">
        <div className="flex justify-center">
          <Image
            src="/dellys-logo.webp"
            alt={dict.brand}
            width={1053}
            height={266}
            priority
            sizes="180px"
            className="h-9 w-auto"
          />
        </div>
        <h1 className="mt-7 text-center font-display text-2xl font-semibold tracking-tight text-mauve-900">
          {isSignup ? dict.nav.signup : dict.nav.login}
        </h1>
        <p className="mx-auto mt-1.5 max-w-xs text-center text-sm text-mauve-500">
          {dict.auth.subtitle}
        </p>
        {error && <div className="alert-error mt-4">{dict.auth.linkError}</div>}
        <LoginForm
          lang={locale}
          dict={dict}
          nextSession={session ?? null}
          mode={isSignup ? "signup" : "login"}
        />
      </div>
      <p className="mt-4 text-center text-xs text-mauve-400">
        {isSignup ? (
          <Link href={`/${locale}/login${sessionQ}`} className="hover:text-mauve-700">
            {dict.auth.haveAccount}
          </Link>
        ) : (
          <Link
            href={`/${locale}/login${sessionQ ? sessionQ + "&" : "?"}mode=signup`}
            className="hover:text-mauve-700"
          >
            {dict.auth.noAccount}
          </Link>
        )}
      </p>
    </div>
  );
}
