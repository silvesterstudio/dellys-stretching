import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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

  // Everything is guarded so a missing Supabase config or outage renders an
  // empty (but working) page instead of crashing the whole route.
  let plans: PlanCard[] = [];
  let pendingPlanIds: string[] = [];
  let userId: string | null = null;

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("membership_plans")
        .select(
          "id, audience, name_ro, name_ru, session_count, price, currency, validity_days, featured",
        )
        .eq("active", true)
        .order("sort_order", { ascending: true });
      plans = (data ?? []) as PlanCard[];

      // Reflect the signed-in user's pending requests for correct button state.
      userId = await getCurrentUserId();
      if (userId) {
        const { data: reqs } = await supabase
          .from("membership_requests")
          .select("plan_id")
          .eq("status", "pending");
        pendingPlanIds = (reqs ?? []).map((r) => r.plan_id as string);
      }
    } catch {
      // degrade to empty
    }
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
