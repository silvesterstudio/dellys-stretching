import { redirect } from "next/navigation";
import Image from "next/image";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { fetchLocations } from "@/lib/locations-server";
import { RegisterForm } from "@/components/auth/RegisterForm";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
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

  // Already signed in — nothing to register.
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
  if (signedIn) {
    redirect(session ? `/${locale}/book/${session}` : `/${locale}/dashboard`);
  }

  const locations = (await fetchLocations()).map((l) => ({ key: l.key, name: l.name }));

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
      >
        <div className="mt-[-5rem] h-72 w-[36rem] max-w-full rounded-full bg-brand-200/35 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-md px-4 py-12 sm:py-20">
        <div className="card p-7 sm:p-9">
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
            {dict.auth.signUpTitle}
          </h1>
          <p className="mx-auto mt-1.5 max-w-xs text-center text-sm text-mauve-500">
            {dict.auth.signUpSubtitle}
          </p>
          <RegisterForm
            lang={locale}
            dict={dict}
            locations={locations}
            nextSession={session ?? null}
          />
        </div>
      </div>
    </div>
  );
}
