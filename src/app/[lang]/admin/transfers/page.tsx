import type { Locale } from "@/lib/constants";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { createAdminClient } from "@/lib/supabase/admin";
import { LegacyTransfers } from "@/components/admin/LegacyTransfers";

export const dynamic = "force-dynamic";

export interface PendingLegacy {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  audience: "adult" | "child";
  plan_label: string | null;
  sessions_remaining: number;
  expires_at: string;
  note: string | null;
}

export interface ClaimedLegacy {
  id: string;
  full_name: string | null;
  sessions_remaining: number;
  expires_at: string;
  claimed_at: string | null;
  claimed_to: string | null; // display name/email of the account it went to
}

// The admin layout already gates on requireAdmin(); this just reads the staging
// table with the service role so it can see every row regardless of RLS.
export default async function TransfersPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "ro") as Locale;
  const dict = getDictionary(locale);

  let pending: PendingLegacy[] = [];
  let claimed: ClaimedLegacy[] = [];

  try {
    const service = createAdminClient();

    const { data: p } = await service
      .from("legacy_memberships")
      .select(
        "id, full_name, phone, email, audience, plan_label, sessions_remaining, expires_at, note",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(500);
    pending = (p ?? []) as PendingLegacy[];

    const { data: c } = await service
      .from("legacy_memberships")
      .select(
        "id, full_name, sessions_remaining, expires_at, claimed_at, claimed_by_user_id",
      )
      .eq("status", "claimed")
      .order("claimed_at", { ascending: false })
      .limit(200);

    const rows = c ?? [];
    const ids = Array.from(
      new Set(rows.map((r) => r.claimed_by_user_id).filter(Boolean) as string[]),
    );
    const nameById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await service
        .from("profiles")
        .select("id, full_name, email")
        .in("id", ids);
      for (const pr of profs ?? []) {
        nameById.set(pr.id, pr.full_name || pr.email || "—");
      }
    }
    claimed = rows.map((r) => ({
      id: r.id,
      full_name: r.full_name,
      sessions_remaining: r.sessions_remaining,
      expires_at: r.expires_at,
      claimed_at: r.claimed_at,
      claimed_to: r.claimed_by_user_id ? nameById.get(r.claimed_by_user_id) ?? "—" : null,
    }));
  } catch {
    // Missing service key / table not migrated yet — render an empty console.
  }

  return (
    <LegacyTransfers lang={locale} dict={dict} pending={pending} claimed={claimed} />
  );
}
