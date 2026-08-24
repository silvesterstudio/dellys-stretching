import { redirect } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

// The fork in the road: sign in, or make an account. Both /login and /register
// are complete on their own — this exists so a QR code or a poster can point at
// one short URL (dellys.md/welcome) without deciding for the visitor which of
// the two they need.
export default async function WelcomePage({
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

  // Already signed in — there is nothing to choose between.
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

  // Carry a pending booking through the detour, so someone who scanned a class
  // QR lands back on that class after signing in.
  const q = session ? `?session=${encodeURIComponent(session)}` : "";

  return (
    <div className="relative overflow-hidden">
      {/* Same soft brand glow as /login and /register — the three pages are one
          flow and should not look like three different sites. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 flex justify-center"
      >
        <div className="mt-[-5rem] h-72 w-[36rem] max-w-full rounded-full bg-brand-200/35 blur-3xl" />
      </div>

      {/* No logo of our own: unlike the Impuls page this copies, the Dellys
          header already sits above with the wordmark and the language toggle,
          so a second one would repeat the brand twice on one screen — and the
          logo's white backplate would show against the pink glow. */}
      <div className="relative mx-auto max-w-md px-4 py-14 sm:py-24">
        <div className="card p-7 sm:p-9">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-mauve-900">
            {dict.auth.welcomeTitle}
          </h1>
          <p className="mt-2 text-base text-mauve-500">{dict.auth.welcomeSubtitle}</p>

          <div className="mt-7 flex flex-col gap-3">
            <Link
              href={`/${locale}/login${q}`}
              className="btn-primary w-full border border-transparent px-6 py-3.5 text-base"
            >
              {dict.auth.welcomeLogin}
            </Link>
            <Link
              href={`/${locale}/register${q}`}
              className="btn-secondary w-full px-6 py-3.5 text-base"
            >
              {dict.auth.welcomeSignUp}
            </Link>
          </div>

          <p className="mt-7 text-center text-sm leading-relaxed text-mauve-400">
            {dict.auth.welcomeNote}
          </p>
        </div>
      </div>
    </div>
  );
}
