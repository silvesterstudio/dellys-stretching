import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { PlansManager, type AdminPlan } from "@/components/admin/PlansManager";
import { ResetPanel } from "@/components/admin/ResetPanel";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);
  const supabase = await createClient();

  const { data } = await supabase
    .from("membership_plans")
    .select(
      "id, audience, name_ro, name_ru, session_count, price, currency, validity_days, featured, active, sort_order",
    )
    .order("sort_order", { ascending: true });

  return (
    <div className="space-y-4">
      <p className="text-sm text-mauve-500">{dict.admin.plansHint}</p>
      <PlansManager lang={locale} dict={dict} initial={(data ?? []) as AdminPlan[]} />
      <ResetPanel kind="plans" dict={dict} />
    </div>
  );
}
