import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { MembersManager } from "@/components/admin/MembersManager";

export const dynamic = "force-dynamic";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("membership_plans")
    .select("id, name_ro, name_ru, audience, session_count, validity_days")
    .eq("active", true)
    .order("sort_order");

  return (
    <MembersManager lang={locale} dict={dict} plans={(plans ?? []) as never} />
  );
}
