import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Sign-up collects a name, phone and studio, but a magic link can only carry
// them as GoTrue user_metadata — the on_auth_user_created trigger (0002) copies
// nothing but email + preferred_lang onto the profile row. So we reconcile them
// on first sign-in.
//
// The studio matters most: every member screen filters by location_id, so a
// CLIENT without one is invisible in BOTH studios' rosters — the same way a
// paying member once went missing. Fall back to the first studio rather than
// leaving it null.
//
// But location_id means something different for staff. Migration 0024 spells it
// out: "For a client this is their home gym. For staff it is the gym they run;
// NULL means 'all gyms'." Pinning a super-admin therefore does not fill a blank
// — it REVOKES their access to the other studio, and the second studio vanishes
// from every admin screen (getAdminScope sets canSwitch = false). That is
// exactly what happened to Rîșcani. So the studio fallback is client-only, and
// the write itself is guarded on role so a future caller cannot repeat it.
//
// Idempotent and blank-filling only: it never overwrites a value the front desk
// has since corrected.
export async function ensureProfileDetails(
  userId: string,
  meta: Record<string, unknown> | null | undefined,
  current: {
    full_name: string | null;
    phone: string | null;
    location_id: string | null;
    role: string | null;
  },
): Promise<void> {
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const metaName = str(meta?.full_name);
  const metaPhone = str(meta?.phone);
  const metaLocation = str(meta?.location_key);

  const needsName = !current.full_name && !!metaName;
  const needsPhone = !current.phone && !!metaPhone;
  // Staff are deliberately excluded — see the note above.
  const needsLocation = !current.location_id && current.role === "client";
  if (!needsName && !needsPhone && !needsLocation) return;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return; // no service key configured — nothing to do
  }

  if (needsName || needsPhone) {
    const patch: { full_name?: string; phone?: string } = {};
    if (needsName) patch.full_name = metaName;
    if (needsPhone) patch.phone = metaPhone;
    const { error } = await admin.from("profiles").update(patch).eq("id", userId);
    if (error) console.error("ensureProfileDetails (details) failed:", error.message, { userId });
  }

  if (!needsLocation) return;

  const { data: locations } = await admin.from("locations").select("id, key").order("sort_order");
  if (!locations?.length) return;
  const locationId =
    (locations.find((l) => l.key === metaLocation)?.id as string | undefined) ??
    (locations[0].id as string);

  // Belt and braces: only ever fills a blank, and only ever for a client, so a
  // staff account can never be pinned — and un-pinned — by a background sync.
  const { error } = await admin
    .from("profiles")
    .update({ location_id: locationId })
    .eq("id", userId)
    .eq("role", "client")
    .is("location_id", null);
  if (error) console.error("ensureProfileDetails (location) failed:", error.message, { userId });
}
