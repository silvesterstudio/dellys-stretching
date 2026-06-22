import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { MembersManager } from "@/components/admin/MembersManager";
import { PendingRequests, type RequestRow } from "@/components/admin/PendingRequests";

export const dynamic = "force-dynamic";

const one = <T,>(v: T | T[] | null | undefined): T | null =>
  Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

export default async function MembersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);
  const supabase = await createClient();

  const [{ data: plans }, { data: reqs }, { data: members }] = await Promise.all([
    supabase
      .from("membership_plans")
      .select("id, name_ro, name_ru, audience, session_count, validity_days")
      .eq("active", true)
      .order("sort_order"),
    supabase
      .from("membership_requests")
      .select(
        `id, created_at,
         profile:profiles ( email, full_name ),
         plan:membership_plans ( name_ro, name_ru, session_count, price, currency )`,
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true }),
    supabase
      .from("profiles")
      .select("id, email, full_name, phone")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const requests: RequestRow[] = (reqs ?? []).map((r: Record<string, unknown>) => {
    const profile = one(r.profile as never) as
      | { email: string; full_name: string | null }
      | null;
    const plan = one(r.plan as never) as
      | {
          name_ro: string;
          name_ru: string;
          session_count: number;
          price: number;
          currency: string;
        }
      | null;
    return {
      id: r.id as string,
      created_at: r.created_at as string,
      member: profile?.full_name || profile?.email || "—",
      plan_name_ro: plan?.name_ro ?? "—",
      plan_name_ru: plan?.name_ru ?? "—",
      session_count: plan?.session_count ?? 0,
      price: plan?.price ?? 0,
      currency: plan?.currency ?? "MDL",
    };
  });

  return (
    <div className="space-y-8">
      <PendingRequests lang={locale} dict={dict} initial={requests} />
      <MembersManager
        lang={locale}
        dict={dict}
        plans={(plans ?? []) as never}
        initialMembers={(members ?? []) as never}
      />
    </div>
  );
}
