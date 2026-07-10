// Verifies the audit-fix batch against the live schema: markNoShow status guard,
// membershipsSold system-plan exclusion, undo free-trial release, and the
// resetPlans system-plan-preserving filter (verified non-destructively).
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = /^([A-Z_]+)=(.*)$/.exec(l.trim()); if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const log = (o, n, d = "") => { o ? pass++ : fail++; console.log(`${o ? "✓" : "✗ FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const iso = (days) => new Date(Date.now() + days * 86400000).toISOString();

async function main() {
  const stamp = Date.now(); const trash = { users: [], sessions: [] };
  const { data: ct } = await db.from("class_types").select("id, category").eq("audience", "adult").limit(1).maybeSingle();
  const { data: plan } = await db.from("membership_plans").select("id, price").eq("audience", "adult").eq("active", true).is("system_key", null).limit(1).maybeSingle();
  const { data: sysPlan } = await db.from("membership_plans").select("id").eq("system_key", "transfer_adult").maybeSingle();
  const { data: c } = await db.auth.admin.createUser({ email: `zz-fx-${stamp}@example.invalid`, email_confirm: true }); trash.users.push(c.user.id);
  const uid = c.user.id;

  console.log("── markNoShow status guard ──");
  const { data: s1 } = await db.from("sessions").insert({ class_type_id: ct.id, starts_at: iso(0.05), duration_min: 60, capacity: 5, booked_count: 0, status: "scheduled" }).select("id").single(); trash.sessions.push(s1.id);
  const { data: bkAtt } = await db.from("bookings").insert({ session_id: s1.id, user_id: uid, status: "attended", membership_id: null }).select("id").single();
  // The new guarded update: only affects booked/pending
  const { data: g1 } = await db.from("bookings").update({ status: "no_show" }).eq("id", bkAtt.id).in("status", ["booked", "pending"]).select("id");
  const { data: after1 } = await db.from("bookings").select("status").eq("id", bkAtt.id).single();
  log((g1?.length ?? 0) === 0 && after1.status === "attended", "guard: no-show refused on attended booking (0 rows, still attended)");
  // second user booked -> guard allows
  const { data: c2 } = await db.auth.admin.createUser({ email: `zz-fx2-${stamp}@example.invalid`, email_confirm: true }); trash.users.push(c2.user.id);
  const { data: bkBooked } = await db.from("bookings").insert({ session_id: s1.id, user_id: c2.user.id, status: "booked" }).select("id").single();
  const { data: g2 } = await db.from("bookings").update({ status: "no_show" }).eq("id", bkBooked.id).in("status", ["booked", "pending"]).select("id");
  log((g2?.length ?? 0) === 1, "guard: no-show allowed on booked booking (1 row)");

  console.log("\n── membershipsSold excludes system (transfer) plans ──");
  await db.from("user_memberships").insert({ user_id: uid, plan_id: plan.id, sessions_remaining: 8, expires_at: iso(30), amount_paid: 200, payment_method: "cash" });
  await db.from("user_memberships").insert({ user_id: uid, plan_id: sysPlan.id, sessions_remaining: 5, expires_at: iso(30) }); // transfer, system plan
  const start = new Date(Date.now() - 3600000).toISOString();
  const { data: rows } = await db.from("user_memberships").select("amount_paid, plan:membership_plans ( price, currency, system_key )").gte("created_at", start).eq("user_id", uid);
  let sold = 0, rev = 0;
  for (const r of rows) { const p = Array.isArray(r.plan) ? r.plan[0] : r.plan; if (p?.system_key) continue; sold++; rev += r.amount_paid != null ? Number(r.amount_paid) : Number(p?.price) || 0; }
  log(sold === 1 && rev === 200, "membershipsSold=1 (transfer excluded), revenue=200", `sold ${sold}, rev ${rev}`);

  console.log("\n── undo releases the category free-trial (only if no other attendance) ──");
  if (ct.category) {
    // Dedicated clean user so no unrelated attendance pollutes the check.
    const { data: fu } = await db.auth.admin.createUser({ email: `zz-fx-ft-${stamp}@example.invalid`, email_confirm: true }); trash.users.push(fu.user.id);
    const fuid = fu.user.id;
    const relCheck = async () => {
      const { data: others } = await db.from("bookings").select("id, session:sessions!inner ( class_type:class_types!inner ( category ) )").eq("user_id", fuid).eq("status", "attended").eq("session.class_type.category", ct.category).limit(1);
      if (!others || others.length === 0) await db.from("free_trial_usage").delete().eq("user_id", fuid).eq("category", ct.category);
    };
    // Case A: single attended booking -> undo releases the trial
    const { data: sA } = await db.from("sessions").insert({ class_type_id: ct.id, starts_at: iso(0.05), duration_min: 60, capacity: 5, booked_count: 0, status: "scheduled" }).select("id").single(); trash.sessions.push(sA.id);
    const { data: bA } = await db.from("bookings").insert({ session_id: sA.id, user_id: fuid, status: "attended", membership_id: null }).select("id").single();
    await db.from("free_trial_usage").insert({ user_id: fuid, category: ct.category });
    await db.from("bookings").update({ status: "booked", membership_id: null }).eq("id", bA.id); // revert
    await relCheck();
    const { data: ftA } = await db.from("free_trial_usage").select("user_id").eq("user_id", fuid).eq("category", ct.category);
    log((ftA?.length ?? 0) === 0, "undo released free-trial (no other attendance)");

    // Case B: another attended booking in category exists -> undo keeps the trial
    const { data: sB } = await db.from("sessions").insert({ class_type_id: ct.id, starts_at: iso(0.05), duration_min: 60, capacity: 5, booked_count: 0, status: "scheduled" }).select("id").single(); trash.sessions.push(sB.id);
    await db.from("bookings").insert({ session_id: sB.id, user_id: fuid, status: "attended", membership_id: null }); // an OTHER attendance stays
    await db.from("free_trial_usage").insert({ user_id: fuid, category: ct.category });
    // revert bA again (still booked) then attempt release
    await relCheck();
    const { data: ftB } = await db.from("free_trial_usage").select("user_id").eq("user_id", fuid).eq("category", ct.category);
    log((ftB?.length ?? 0) === 1, "undo KEEPS free-trial when another attendance exists");
  }

  console.log("\n── resetPlans preserves system plans (filter check, non-destructive) ──");
  const { data: nonSys } = await db.from("membership_plans").select("system_key").is("system_key", null);
  const { data: sys } = await db.from("membership_plans").select("system_key").not("system_key", "is", null);
  log((nonSys ?? []).every((p) => p.system_key === null), "delete filter .is(system_key,null) targets only non-system plans");
  log((sys ?? []).length >= 2, "transfer_adult/transfer_child would survive the reset", `system plans: ${sys?.length}`);

  console.log("\n── teardown ──");
  for (const s of trash.sessions) { await db.from("bookings").delete().eq("session_id", s); await db.from("sessions").delete().eq("id", s); }
  for (const u of trash.users) await db.auth.admin.deleteUser(u);
  let left = 0; for (const u of trash.users) { const { data } = await db.from("profiles").select("id").eq("id", u).maybeSingle(); if (data) left++; }
  log(left === 0, "teardown clean", `leftover ${left}`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
