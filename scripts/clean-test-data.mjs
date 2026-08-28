// Remove every throwaway account a test run may have left in the live database.
//
// This exists because per-id cleanup is not enough. A suite that throws, is
// interrupted, or has one delete fail silently leaves accounts behind — and
// those accounts are not inert: their memberships show up in the owner's
// dashboard as revenue. A run once left 600 MDL of phantom income and six
// invented members named "Pick racea" on the Încasări recente panel.
//
// Scoped strictly to @example.invalid, a reserved TLD that can never belong to
// a real member, so this can never touch a paying customer.
//
// Run on its own:   node scripts/clean-test-data.mjs
// Or from a suite:  import { sweepTestData } from "./clean-test-data.mjs";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const TEST_EMAIL = /@example\.invalid$/;

function client() {
  const env = {};
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

export async function sweepTestData({ quiet = false } = {}) {
  const db = client();
  const { data: profs } = await db.from("profiles").select("id, email");
  const victims = (profs ?? []).filter((p) => TEST_EMAIL.test(p.email ?? ""));

  let money = 0;
  for (const p of victims) {
    const { data: mems } = await db
      .from("user_memberships")
      .select("amount_paid")
      .eq("user_id", p.id);
    money += (mems ?? []).reduce((a, m) => a + Number(m.amount_paid || 0), 0);
    // Order matters: rows that reference the profile go first, or the delete is
    // refused and the account survives.
    await db.from("bookings").delete().eq("user_id", p.id);
    await db.from("user_memberships").delete().eq("user_id", p.id);
    await db.from("free_trial_usage").delete().eq("user_id", p.id);
    await db.from("children").delete().eq("parent_id", p.id);
    await db.from("guest_bookings").update({ claimed_by: null }).eq("claimed_by", p.id);
    await db.auth.admin.deleteUser(p.id);
  }

  // Report what is actually left, not what we tried to delete.
  const { data: after } = await db.from("profiles").select("id, email");
  const left = (after ?? []).filter((p) => TEST_EMAIL.test(p.email ?? "")).length;
  const known = new Set((after ?? []).map((p) => p.id));
  const { data: mems2 } = await db.from("user_memberships").select("user_id");
  const orphans = (mems2 ?? []).filter((m) => !known.has(m.user_id)).length;

  if (!quiet) {
    console.log(
      `sweep: removed ${victims.length} test account(s)` +
        (money ? `, ${money} MDL of phantom revenue` : "") +
        `; ${left} left, ${orphans} orphan membership(s)`,
    );
  }
  if (left || orphans) {
    console.error(`sweep: ${left} test account(s) and ${orphans} orphan membership(s) SURVIVED`);
  }
  return { removed: victims.length, money, left, orphans };
}

// Direct invocation.
if (process.argv[1] && process.argv[1].endsWith("clean-test-data.mjs")) {
  const r = await sweepTestData();
  process.exit(r.left || r.orphans ? 1 : 0);
}
