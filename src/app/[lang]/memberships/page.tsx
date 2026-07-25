import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUserId } from "@/lib/auth";
import { fetchLocations, resolveLocation } from "@/lib/locations-server";
import { MembershipPlans, type PlanCard } from "@/components/memberships/MembershipPlans";

export const dynamic = "force-dynamic";

export default async function MembershipsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ loc?: string }>;
}) {
  const { lang } = await params;
  const { loc } = await searchParams;
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

      // Each studio sells its own price list. A signed-in member always sees
      // their own gym's — a membership bought at the other one wouldn't work
      // for them — while visitors follow ?loc= / their remembered choice.
      userId = await getCurrentUserId();
      let locationId: string | null = null;
      if (userId) {
        const { data: me } = await supabase
          .from("profiles")
          .select("location_id")
          .eq("id", userId)
          .maybeSingle();
        locationId = me?.location_id ?? null;
      }
      if (!locationId) {
        const locations = await fetchLocations();
        locationId = (await resolveLocation(locations, loc ?? null))?.id ?? null;
      }

      let planQuery = supabase
        .from("membership_plans")
        .select(
          "id, audience, name_ro, name_ru, session_count, price, currency, validity_days, featured",
        )
        .eq("active", true);
      if (locationId) planQuery = planQuery.eq("location_id", locationId);
      const { data } = await planQuery.order("sort_order", { ascending: true });
      plans = (data ?? []) as PlanCard[];

      // Reflect the signed-in user's pending requests for correct button state.
      if (userId) {
        const { data: reqs } = await supabase
          .from("membership_requests")
          .select("plan_id")
          .eq("status", "pending")
          .eq("user_id", userId); // scope explicitly; don't lean on RLS alone
        pendingPlanIds = (reqs ?? []).map((r) => r.plan_id as string);
      }
    } catch {
      // degrade to empty
    }
  }

  return (
    <div className="container-page safe-x space-y-8 py-8 sm:py-12">
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
