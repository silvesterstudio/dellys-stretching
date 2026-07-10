import { redirect } from "next/navigation";
import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { PendingRequests, type RequestRow } from "@/components/admin/PendingRequests";
import { MembersExplorer } from "@/components/admin/MembersExplorer";
import { ExportMembersButton } from "@/components/admin/ExportMembersButton";
import { ResetPanel } from "@/components/admin/ResetPanel";
import type { AdminMemberRow } from "@/app/[lang]/admin/actions";

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
  try {
    await requireAdmin();
  } catch {
    redirect(`/${locale}/staff`);
  }

  let plans: Record<string, unknown>[] = [];
  let reqs: Record<string, unknown>[] = [];
  let members: AdminMemberRow[] = [];
  try {
    const admin = createAdminClient();
    const [p, r, mem] = await Promise.all([
      admin
        .from("membership_plans")
        .select("id, name_ro, name_ru, audience, session_count, validity_days")
        .eq("active", true)
        .order("sort_order"),
      admin
        .from("membership_requests")
        .select(
          `id, created_at,
           profile:profiles ( email, full_name ),
           plan:membership_plans ( name_ro, name_ru, session_count, price, currency )`,
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true }),
      admin
        .from("profiles")
        .select("id, email, full_name, phone, created_at")
        .eq("role", "client")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    plans = (p.data ?? []) as Record<string, unknown>[];
    reqs = (r.data ?? []) as Record<string, unknown>[];
    members = (mem.data ?? []) as AdminMemberRow[];
  } catch {
    // Missing service key / Supabase blip → render the page empty, not a 500.
  }

  const requests: RequestRow[] = reqs.map((r) => {
    const profile = one(r.profile as never) as
      | { email: string; full_name: string | null }
      | null;
    const plan = one(r.plan as never) as
      | { name_ro: string; name_ru: string; session_count: number; price: number; currency: string }
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
      <div className="flex justify-end">
        <ExportMembersButton dict={dict} />
      </div>
      <PendingRequests lang={locale} dict={dict} initial={requests} />
      <MembersExplorer
        lang={locale}
        dict={dict}
        plans={plans as never}
        initialMembers={members}
      />
      <ResetPanel kind="members" dict={dict} />
    </div>
  );
}
