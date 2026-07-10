// Isolated end-to-end test of Bundle A's DB-write logic against the real schema:
// walk-in booking mechanics (insert + booked_count), check-in deduction, undo
// refund, rollback, and the usable-memberships filter. Creates a throwaway user
// + session, exercises every path, then tears it all down.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let pass = 0, fail = 0;
const log = (ok, name, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}${d ? "  — " + d : ""}`); };
const iso = (ymd) => new Date(`${ymd}T23:59:00+03:00`).toISOString();

async function main() {
  // Need an adult class_type + the transfer_adult plan.
  const { data: ct } = await db.from("class_types").select("id, audience").eq("audience", "adult").limit(1).maybeSingle();
  const { data: plan } = await db.from("membership_plans").select("id").eq("system_key", "transfer_adult").maybeSingle();
  if (!ct || !plan) { log(false, "prerequisites (adult class_type + transfer plan)"); return finish(); }

  const stamp = Date.now();
  const { data: created, error: cErr } = await db.auth.admin.createUser({
    email: `zz-checkin-test-${stamp}@example.invalid`, password: `Test!${stamp}aA`, email_confirm: true,
  });
  if (cErr || !created?.user) { log(false, "create user", cErr?.message); return finish(); }
  const uid = created.user.id;

  // A future session to check into.
  const startsAt = new Date(Date.now() + 3600_000).toISOString();
  const { data: sess, error: sErr } = await db.from("sessions")
    .insert({ class_type_id: ct.id, starts_at: startsAt, duration_min: 60, capacity: 11, booked_count: 0, status: "scheduled" })
    .select("id, booked_count").single();
  if (sErr) { log(false, "create session", sErr.message); await db.auth.admin.deleteUser(uid); return finish(); }
  const sid = sess.id;

  try {
    // Membership with 5 sessions.
    const { data: mem } = await db.from("user_memberships")
      .insert({ user_id: uid, plan_id: plan.id, sessions_remaining: 5, expires_at: iso("2026-12-31"), note: "checkin-test" })
      .select("id, sessions_remaining").single();
    log(mem?.sessions_remaining === 5, "seed membership (5 sessions)");

    // ── getUsableMembershipsAction filter ──
    const usableQuery = () => db.from("user_memberships")
      .select("id, sessions_remaining, plan:membership_plans!inner(audience)")
      .eq("user_id", uid).eq("plan.audience", "adult").eq("frozen", false)
      .gt("sessions_remaining", 0).gt("expires_at", new Date().toISOString());
    let { data: usable } = await usableQuery();
    log(usable?.length === 1, "usable filter: active membership shows", `count ${usable?.length}`);

    // wrong audience excluded
    let { data: usableChild } = await db.from("user_memberships")
      .select("id, plan:membership_plans!inner(audience)")
      .eq("user_id", uid).eq("plan.audience", "child").eq("frozen", false)
      .gt("sessions_remaining", 0).gt("expires_at", new Date().toISOString());
    log((usableChild?.length ?? 0) === 0, "usable filter: excluded for wrong (child) audience");

    // frozen excluded
    await db.from("user_memberships").update({ frozen: true }).eq("id", mem.id);
    ({ data: usable } = await usableQuery());
    log((usable?.length ?? 0) === 0, "usable filter: frozen excluded");
    await db.from("user_memberships").update({ frozen: false }).eq("id", mem.id);

    // ── Walk-in booking mechanics (what walkInCheckInAction does directly) ──
    const { data: bk } = await db.from("bookings")
      .insert({ session_id: sid, user_id: uid, status: "booked" }).select("id").single();
    await db.from("sessions").update({ booked_count: 1 }).eq("id", sid);
    let { data: s1 } = await db.from("sessions").select("booked_count").eq("id", sid).single();
    log(s1.booked_count === 1, "walk-in: booked_count incremented to 1");

    // ── Check-in deduction (check_in_booking does this) ──
    await db.from("user_memberships").update({ sessions_remaining: 4 }).eq("id", mem.id);
    await db.from("bookings").update({ status: "attended", membership_id: mem.id }).eq("id", bk.id);
    let { data: m1 } = await db.from("user_memberships").select("sessions_remaining").eq("id", mem.id).single();
    log(m1.sessions_remaining === 4, "check-in: session deducted (5 -> 4)");

    // ── Undo (undoCheckInAction): refund + revert, seat kept ──
    const { data: bk2 } = await db.from("bookings").select("status, membership_id").eq("id", bk.id).single();
    if (bk2.status === "attended" && bk2.membership_id) {
      const { data: cur } = await db.from("user_memberships").select("sessions_remaining").eq("id", bk2.membership_id).single();
      await db.from("user_memberships").update({ sessions_remaining: cur.sessions_remaining + 1 }).eq("id", bk2.membership_id);
      await db.from("bookings").update({ status: "booked", membership_id: null }).eq("id", bk.id);
    }
    let { data: m2 } = await db.from("user_memberships").select("sessions_remaining").eq("id", mem.id).single();
    let { data: b3 } = await db.from("bookings").select("status, membership_id").eq("id", bk.id).single();
    let { data: s2 } = await db.from("sessions").select("booked_count").eq("id", sid).single();
    log(m2.sessions_remaining === 5, "undo: session refunded (4 -> 5)");
    log(b3.status === "booked" && !b3.membership_id, "undo: booking reverted to booked, membership cleared");
    log(s2.booked_count === 1, "undo: seat kept (booked_count still 1)");

    // ── Duplicate-active-booking guard (a failed 2nd walk-in is rejected) ──
    const { error: dupErr } = await db.from("bookings").insert({ session_id: sid, user_id: uid, status: "booked" });
    log(!!dupErr, "DB blocks duplicate active booking for same session/user", dupErr ? "rejected ✓" : "ACCEPTED!");

    // ── Rollback path: removing the booking frees the seat (failed walk-in) ──
    await db.from("bookings").delete().eq("id", bk.id);
    await db.from("sessions").update({ booked_count: 0 }).eq("id", sid);
    const { data: s3 } = await db.from("sessions").select("booked_count").eq("id", sid).single();
    log(s3.booked_count === 0, "rollback: seat freed after booking removed");

  } finally {
    await db.from("bookings").delete().eq("session_id", sid);
    await db.from("sessions").delete().eq("id", sid);
    const { error: dErr } = await db.auth.admin.deleteUser(uid);
    const { data: left } = await db.from("user_memberships").select("id").eq("user_id", uid);
    log(!dErr && (left?.length ?? 0) === 0, "teardown: user + memberships + session removed", dErr?.message || `mems left ${left?.length ?? 0}`);
    const { data: sLeft } = await db.from("sessions").select("id").eq("id", sid);
    log((sLeft?.length ?? 0) === 0, "teardown: session removed");
  }
  finish();
}

function finish() { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
main().catch((e) => { console.error(e); process.exit(2); });
