import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/auth";
import { MembershipPlans, type PlanCard } from "@/components/memberships/MembershipPlans";

export const dynamic = "force-dynamic";

export default async function MembershipsPage({
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
      "id, audience, name_ro, name_ru, session_count, price, currency, validity_days, featured",
    )
    .eq("active", true)
    .order("sort_order", { ascending: true });

  const plans = (data ?? []) as PlanCard[];

  // Reflect the signed-in user's already-pending requests so the buttons show
  // the right state on first paint.
  const userId = await getCurrentUserId();
  let pendingPlanIds: string[] = [];
  if (userId) {
    const { data: reqs } = await supabase
      .from("membership_requests")
      .select("plan_id")
      .eq("status", "pending");
    pendingPlanIds = (reqs ?? []).map((r) => r.plan_id as string);
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-mauve-900">
          {dict.memberships.title}
        </h1>
        <p className="mt-1 text-mauve-500">{dict.memberships.subtitle}</p>
      </div>

      <MembershipPlans
        lang={locale}
        dict={dict}
        plans={plans}
        loggedIn={!!userId}
        loginHref={`/${locale}/login`}
        initialPending={pendingPlanIds}
      />
    </div>
  );
}
