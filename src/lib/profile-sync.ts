import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Sign-up collects a name, phone and studio, but a magic link can only carry
// them as GoTrue user_metadata — the on_auth_user_created trigger (0002) copies
// nothing but email + preferred_lang onto the profile row. So we reconcile them
// on first sign-in.
//
// The studio matters most: every member screen filters by location_id, so a
// profile without one is invisible in BOTH studios' rosters — the same way a
// paying member once went missing. Fall back to the first studio rather than
// leaving it null.
//
// Idempotent and blank-filling only: it never overwrites a value the front desk
// has since corrected.
export async function ensureProfileDetails(
  userId: string,
  meta: Record<string, unknown> | null | undefined,
  current: { full_name: string | null; phone: string | null; location_id: string | null },
): Promise<void> {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const metaName = str(meta?.full_name);
  const metaPhone = str(meta?.phone);
  const metaLocation = str(meta?.location_key);

  const needsName = !current.full_name && !!metaName;
  const needsPhone = !current.phone && !!metaPhone;
  const needsLocation = !current.location_id;
  if (!needsName && !needsPhone && !needsLocation) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return; // no service key configured — nothing to do
  }

  const patch: { full_name?: string; phone?: string; location_id?: string } = {};
  if (needsName) patch.full_name = metaName;
  if (needsPhone) patch.phone = metaPhone;

  if (needsLocation) {
    const { data: locations } = await admin.from("locations").select("id, key").order("sort_order");
    if (locations?.length) {
      patch.location_id =
        (locations.find((l) => l.key === metaLocation)?.id as string | undefined) ??
        (locations[0].id as string);
    }
  }

  if (!Object.keys(patch).length) return;
  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) console.error("ensureProfileDetails failed:", error.message, { userId });
}
