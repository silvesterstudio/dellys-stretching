import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PlansManager, type AdminPlan } from "@/components/admin/PlansManager";
import { ResetPanel } from "@/components/admin/ResetPanel";
import { LocationBar } from "@/components/admin/LocationBar";
import { getAdminScope } from "@/lib/locations-server";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);
  // Admin-only page (the layout now admits reception staff too).
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect("/admin/today");
  }
  const supabase = await createClient();
  // Each studio sells its own price list.
  const scope = await getAdminScope(profile);

  let query = supabase
    .from("membership_plans")
    .select(
      "id, audience, name_ro, name_ru, session_count, price, currency, validity_days, featured, active, sort_order",
    )
    // Hide internal system plans (e.g. the hidden "transferred membership" plans)
    // so they can't be edited or deleted from the price catalog.
    .is("system_key", null);
  if (scope.activeId) query = query.eq("location_id", scope.activeId);
  const { data } = await query.order("sort_order", { ascending: true });

  return (
    <div className="space-y-4">
      <LocationBar
        locations={scope.locations}
        activeId={scope.activeId}
        canSwitch={scope.canSwitch}
        lang={locale}
        dict={dict}
      />
      <p className="text-sm text-mauve-500">{dict.admin.plansHint}</p>
      <PlansManager
        lang={locale}
        dict={dict}
        initial={(data ?? []) as AdminPlan[]}
        locationId={scope.activeId}
      />
      {/* Deletes every studio's catalogue — unrestricted admins only. */}
      {profile.location_id === null && <ResetPanel kind="plans" dict={dict} />}
    </div>
  );
}
