// Pre-ship behavioral suite: exercises the real runtime paths (RPCs via real
// JWTs, freeze/revenue logic) end to end against the live schema, then cleans up.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const db = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });
const anon = createClient(URL, ANON, { auth: { persistSession: false } });
let pass = 0, fail = 0;
const log = (ok, n, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✓" : "✗ FAIL"}  ${n}${d ? "  — " + d : ""}`); };
const iso = (days) => new Date(Date.now() + days * 86400000).toISOString();
const pw = (s) => `Tst!${s}aA`;

async function jwtClient(email, password) {
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return createClient(URL, ANON, { global: { headers: { Authorization: `Bearer ${data.session.access_token}` } }, auth: { persistSession: false } });
}
async function rpcErr(client, fn, args) {
  const { error } = await client.rpc(fn, args);
  return error ? (error.message || "").toUpperCase() : null;
}

async function main() {
  const stamp = Date.now();
  const trash = { users: [], sessions: [] };
  const { data: adultCt } = await db.from("class_types").select("id,category").eq("audience", "adult").limit(1).maybeSingle();
  const { data: childCt } = await db.from("class_types").select("id").eq("audience", "child").limit(1).maybeSingle();
  const { data: adultPlan } = await db.from("membership_plans").select("id").eq("audience", "adult").eq("active", true).is("system_key", null).limit(1).maybeSingle();
  const { data: childPlan } = await db.from("membership_plans").select("id").eq("audience", "child").eq("active", true).is("system_key", null).limit(1).maybeSingle();

  // Actors: an admin (to run check_in_booking) + a client
  const adminEmail = `zz-pb-admin-${stamp}@example.invalid`;
  const { data: a } = await db.auth.admin.createUser({ email: adminEmail, password: pw(stamp), email_confirm: true });
  await db.from("profiles").update({ role: "admin" }).eq("id", a.user.id); trash.users.push(a.user.id);
  const clientEmail = `zz-pb-client-${stamp}@example.invalid`;
  const { data: c } = await db.auth.admin.createUser({ email: clientEmail, password: pw(stamp), email_confirm: true, user_metadata: { full_name: "PB Client" } });
  trash.users.push(c.user.id);
  const adminC = await jwtClient(adminEmail, pw(stamp));
  const clientC = await jwtClient(clientEmail, pw(stamp));

  // A future adult session
  const { data: sess } = await db.from("sessions").insert({ class_type_id: adultCt.id, starts_at: iso(0.05), duration_min: 60, capacity: 2, booked_count: 0, status: "scheduled" }).select("id").single();
  trash.sessions.push(sess.id);

  console.log("\n── check_in_booking guards (via admin JWT) ──");
  // adult membership with 2 sessions
  const { data: mem } = await db.from("user_memberships").insert({ user_id: c.user.id, plan_id: adultPlan.id, sessions_remaining: 2, expires_at: iso(30) }).select("id").single();
  // booking for the client
  const { data: bk } = await db.from("bookings").insert({ session_id: sess.id, user_id: c.user.id, status: "booked" }).select("id").single();
  await db.from("sessions").update({ booked_count: 1 }).eq("id", sess.id);

  // wrong-user membership
  const { data: mem2u } = await db.auth.admin.createUser({ email: `zz-pb-o-${stamp}@example.invalid`, email_confirm: true }); trash.users.push(mem2u.user.id);
  const { data: memWrong } = await db.from("user_memberships").insert({ user_id: mem2u.user.id, plan_id: adultPlan.id, sessions_remaining: 5, expires_at: iso(30) }).select("id").single();
  log((await rpcErr(adminC, "check_in_booking", { p_booking_id: bk.id, p_membership_id: memWrong.id })) === "MEMBERSHIP_WRONG_USER", "check_in rejects wrong-user membership");
  // expired
  const { data: memExp } = await db.from("user_memberships").insert({ user_id: c.user.id, plan_id: adultPlan.id, sessions_remaining: 5, expires_at: iso(-1) }).select("id").single();
  log((await rpcErr(adminC, "check_in_booking", { p_booking_id: bk.id, p_membership_id: memExp.id })) === "MEMBERSHIP_EXPIRED", "check_in rejects expired membership");
  // empty
  const { data: memEmpty } = await db.from("user_memberships").insert({ user_id: c.user.id, plan_id: adultPlan.id, sessions_remaining: 0, expires_at: iso(30) }).select("id").single();
  log((await rpcErr(adminC, "check_in_booking", { p_booking_id: bk.id, p_membership_id: memEmpty.id })) === "MEMBERSHIP_EMPTY", "check_in rejects empty membership");
  // frozen
  const { data: memFroz } = await db.from("user_memberships").insert({ user_id: c.user.id, plan_id: adultPlan.id, sessions_remaining: 5, expires_at: iso(30), frozen: true }).select("id").single();
  log((await rpcErr(adminC, "check_in_booking", { p_booking_id: bk.id, p_membership_id: memFroz.id })) === "MEMBERSHIP_FROZEN", "check_in rejects frozen membership");
  // wrong audience: child plan on adult class
  if (childPlan) {
    const { data: memChild } = await db.from("user_memberships").insert({ user_id: c.user.id, plan_id: childPlan.id, sessions_remaining: 5, expires_at: iso(30) }).select("id").single();
    log((await rpcErr(adminC, "check_in_booking", { p_booking_id: bk.id, p_membership_id: memChild.id })) === "MEMBERSHIP_WRONG_AUDIENCE", "check_in rejects wrong-audience membership");
  }
  // client (non-staff) cannot check in
  log((await rpcErr(clientC, "check_in_booking", { p_booking_id: bk.id, p_membership_id: null })) === "FORBIDDEN", "check_in FORBIDDEN for non-staff client");

  // happy path: deduct 2 -> 1, attended; free trial consumed
  const okErr = await rpcErr(adminC, "check_in_booking", { p_booking_id: bk.id, p_membership_id: mem.id });
  const { data: memAfter } = await db.from("user_memberships").select("sessions_remaining").eq("id", mem.id).single();
  const { data: bkAfter } = await db.from("bookings").select("status,membership_id").eq("id", bk.id).single();
  log(!okErr && memAfter.sessions_remaining === 1 && bkAfter.status === "attended", "check_in happy: deducted 2->1, attended", okErr || "");
  if (adultCt.category) {
    const { data: ft } = await db.from("free_trial_usage").select("user_id").eq("user_id", c.user.id).eq("category", adultCt.category);
    log((ft?.length ?? 0) === 1, "check_in consumed the category free trial");
  }
  // re-check-in the same (now attended) booking -> NOT_CHECKINABLE
  log((await rpcErr(adminC, "check_in_booking", { p_booking_id: bk.id, p_membership_id: mem.id })) === "NOT_CHECKINABLE", "check_in rejects already-attended booking");

  console.log("\n── book_session guards (via client JWT) ──");
  // past session
  const { data: pastS } = await db.from("sessions").insert({ class_type_id: adultCt.id, starts_at: iso(-1), duration_min: 60, capacity: 5, booked_count: 0, status: "scheduled" }).select("id").single(); trash.sessions.push(pastS.id);
  log((await rpcErr(clientC, "book_session", { p_session_id: pastS.id, p_child_id: null })) === "PAST_SESSION", "book rejects past session");
  // full session (capacity 1, already booked by other)
  const { data: fullS } = await db.from("sessions").insert({ class_type_id: adultCt.id, starts_at: iso(1), duration_min: 60, capacity: 1, booked_count: 1, status: "scheduled" }).select("id").single(); trash.sessions.push(fullS.id);
  log((await rpcErr(clientC, "book_session", { p_session_id: fullS.id, p_child_id: null })) === "SESSION_FULL", "book rejects full session");
  // child class requires child
  if (childCt) {
    const { data: childS } = await db.from("sessions").insert({ class_type_id: childCt.id, starts_at: iso(1), duration_min: 60, capacity: 5, booked_count: 0, status: "scheduled" }).select("id").single(); trash.sessions.push(childS.id);
    log((await rpcErr(clientC, "book_session", { p_session_id: childS.id, p_child_id: null })) === "CHILD_REQUIRED", "book child class requires a child");
  }
  // happy book on a fresh future adult session
  const { data: freeS } = await db.from("sessions").insert({ class_type_id: adultCt.id, starts_at: iso(1), duration_min: 60, capacity: 5, booked_count: 0, status: "scheduled" }).select("id").single(); trash.sessions.push(freeS.id);
  const { data: bid, error: bErr } = await clientC.rpc("book_session", { p_session_id: freeS.id, p_child_id: null });
  const { data: freeSAfter } = await db.from("sessions").select("booked_count").eq("id", freeS.id).single();
  log(!bErr && bid && freeSAfter.booked_count === 1, "book happy: booked_count 0->1", bErr?.message || "");
  // duplicate
  log((await rpcErr(clientC, "book_session", { p_session_id: freeS.id, p_child_id: null })) === "ALREADY_BOOKED", "book rejects duplicate active booking");

  console.log("\n── freeze extension math (mirrors setMembershipFrozenAction) ──");
  const origExp = iso(10);
  const { data: fm } = await db.from("user_memberships").insert({ user_id: c.user.id, plan_id: adultPlan.id, sessions_remaining: 5, expires_at: origExp }).select("id").single();
  const doFreeze = async (id, startAgoDays) => db.from("user_memberships").update({ frozen: true, freeze_start_date: iso(-startAgoDays) }).eq("id", id);
  const doUnfreeze = async (id) => {
    const { data: m } = await db.from("user_memberships").select("expires_at,freeze_start_date").eq("id", id).single();
    let ne = m.expires_at;
    if (m.freeze_start_date) { const fd = Math.max(0, Math.round((Date.now() - new Date(m.freeze_start_date).getTime()) / 86400000)); if (fd > 0) ne = new Date(new Date(m.expires_at).getTime() + fd * 86400000).toISOString(); }
    await db.from("user_memberships").update({ frozen: false, freeze_start_date: null, expires_at: ne }).eq("id", id);
  };
  await doFreeze(fm.id, 3); await doUnfreeze(fm.id);
  let { data: fmA } = await db.from("user_memberships").select("expires_at").eq("id", fm.id).single();
  log(Math.round((new Date(fmA.expires_at) - new Date(origExp)) / 86400000) === 3, "freeze 3d -> expiry +3d");
  // second cycle: +5d more, total +8
  await doFreeze(fm.id, 5); await doUnfreeze(fm.id);
  ({ data: fmA } = await db.from("user_memberships").select("expires_at,frozen,freeze_start_date").eq("id", fm.id).single());
  log(Math.round((new Date(fmA.expires_at) - new Date(origExp)) / 86400000) === 8 && !fmA.frozen && !fmA.freeze_start_date, "second freeze 5d -> total +8d, clean state");

  console.log("\n── revenue: amount_paid vs plan.price fallback ──");
  const wStart = iso(0) < iso(0) ? iso(0) : new Date(Date.now() - 3600000).toISOString();
  const ru = (await db.auth.admin.createUser({ email: `zz-pb-rev-${stamp}@example.invalid`, email_confirm: true })).data; trash.users.push(ru.user.id);
  await db.from("user_memberships").insert({ user_id: ru.user.id, plan_id: adultPlan.id, sessions_remaining: 8, expires_at: iso(30), amount_paid: 250, payment_method: "cash" });
  await db.from("user_memberships").insert({ user_id: ru.user.id, plan_id: adultPlan.id, sessions_remaining: 8, expires_at: iso(30), amount_paid: null }); // legacy -> falls back to plan price
  const { data: planPrice } = await db.from("membership_plans").select("price").eq("id", adultPlan.id).single();
  const { data: rows } = await db.from("user_memberships").select("amount_paid, plan:membership_plans(price)").eq("user_id", ru.user.id);
  let rev = 0; for (const r of rows) { const p = Array.isArray(r.plan) ? r.plan[0] : r.plan; rev += r.amount_paid != null ? Number(r.amount_paid) : Number(p?.price) || 0; }
  log(rev === 250 + Number(planPrice.price), "revenue = 250 + plan-price fallback", `got ${rev}, expected ${250 + Number(planPrice.price)}`);

  // ── teardown ──
  console.log("\n── teardown ──");
  for (const s of trash.sessions) { await db.from("bookings").delete().eq("session_id", s); await db.from("sessions").delete().eq("id", s); }
  for (const u of trash.users) await db.auth.admin.deleteUser(u);
  let left = 0; for (const u of trash.users) { const { data } = await db.from("profiles").select("id").eq("id", u).maybeSingle(); if (data) left++; }
  log(left === 0, "teardown clean", `leftover ${left}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
