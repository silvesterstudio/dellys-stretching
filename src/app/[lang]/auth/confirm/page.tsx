import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { AuthConfirm } from "@/components/auth/AuthConfirm";

export const dynamic = "force-dynamic";

// Magic-link landing page. The email link arrives (via /auth/callback) with
// the session tokens in the URL #fragment, which only the browser can read —
// the client component below lets the Supabase client consume them, then
// forwards to ?next (the booking the user came for, or their dashboard).
export default async function AuthConfirmPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { lang } = await params;
  const { next: rawNext } = await searchParams;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);
  // Same-origin in-app paths only (no open redirect).
  const next =
    rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//")
      ? rawNext
      : `/${locale}/dashboard`;

  return <AuthConfirm locale={locale} next={next} loadingLabel={dict.common.loading} />;
}
