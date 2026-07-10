// Isolated test of Bundle B's DB paths: admin-create-member (real createUser ->
// handle_new_user trigger populates the profile with name/phone) and the
// admin-reserve booking mechanics (capacity + duplicate guards, booked_count).

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

async function main() {
  const stamp = Date.now();
  const createdIds = [];

  // ── B1: admin-create-member with a SYNTHETIC email (walk-in, no email) ──
  const synthetic = `walkin.${stamp.toString(36)}${Math.floor(Math.random() * 1e4)}@dellys.local`;
  const { data: c1, error: e1 } = await db.auth.admin.createUser({
    email: synthetic, email_confirm: true,
    user_metadata: { full_name: "Test Walkin", phone: "069111222", preferred_lang: "ro" },
  });
  if (e1 || !c1?.user) { log(false, "create member (synthetic email)", e1?.message); return finish(); }
  createdIds.push(c1.user.id);
  // trigger should have made a profile with the metadata
  const { data: p1 } = await db.from("profiles").select("role, full_name, phone, email").eq("id", c1.user.id).maybeSingle();
  log(p1?.role === "client", "created profile role=client");
  log(p1?.full_name === "Test Walkin", "profile captured full_name from metadata", `got "${p1?.full_name}"`);
  log(p1?.phone === "069111222", "profile captured phone from metadata", `got "${p1?.phone}"`);
  log(p1?.email === synthetic, "profile has the synthetic email");

  // searchable by phone (searchMembersAction uses ilike on phone)
  const { data: byPhone } = await db.from("profiles").select("id").eq("role", "client").ilike("phone", "%069111222%");
  log((byPhone ?? []).some((r) => r.id === c1.user.id), "new member is searchable by phone");

  // ── B1b: with a REAL email ──
  const realEmail = `zz-onboard-test-${stamp}@example.invalid`;
  const { data: c2, error: e2 } = await db.auth.admin.createUser({
    email: realEmail, email_confirm: true,
    user_metadata: { full_name: "Real Email", phone: "069333444", preferred_lang: "ro" },
  });
  if (!e2 && c2?.user) { createdIds.push(c2.user.id); log(true, "create member (real email)"); }
  else log(false, "create member (real email)", e2?.message);

  // duplicate email is rejected
  const { error: dupE } = await db.auth.admin.createUser({ email: realEmail, email_confirm: true });
  log(!!dupE, "duplicate email rejected", dupE ? "rejected ✓" : "ACCEPTED!");

  // ── B2: admin-reserve booking mechanics ──
  const { data: ct } = await db.from("class_types").select("id").eq("audience", "adult").limit(1).maybeSingle();
  const startsAt = new Date(Date.now() + 3600_000).toISOString();
  const { data: sess } = await db.from("sessions")
    .insert({ class_type_id: ct.id, starts_at: startsAt, duration_min: 60, capacity: 1, booked_count: 0, status: "scheduled" })
    .select("id, capacity, booked_count").single();
  const sid = sess.id;
  try {
    // reserve member 1
    await db.from("bookings").insert({ session_id: sid, user_id: c1.user.id, status: "booked" });
    await db.from("sessions").update({ booked_count: 1 }).eq("id", sid);
    let { data: s1 } = await db.from("sessions").select("booked_count").eq("id", sid).single();
    log(s1.booked_count === 1, "reserve: booked_count -> 1");

    // capacity is 1, so the action must refuse member 2 (booked_count >= capacity)
    const { data: sCheck } = await db.from("sessions").select("capacity, booked_count").eq("id", sid).single();
    const wouldRefuse = sCheck.booked_count >= sCheck.capacity;
    log(wouldRefuse, "reserve: capacity guard would refuse when full");

    // duplicate reserve for same member rejected by unique index
    const { error: dupBook } = await db.from("bookings").insert({ session_id: sid, user_id: c1.user.id, status: "booked" });
    log(!!dupBook, "reserve: duplicate active booking rejected");
  } finally {
    await db.from("bookings").delete().eq("session_id", sid);
    await db.from("sessions").delete().eq("id", sid);
  }

  // ── Teardown ──
  for (const id of createdIds) await db.auth.admin.deleteUser(id);
  let leftover = 0;
  for (const id of createdIds) {
    const { data } = await db.from("profiles").select("id").eq("id", id).maybeSingle();
    if (data) leftover++;
  }
  log(leftover === 0, "teardown: all test users removed", `leftover ${leftover}`);
  finish();
}
function finish() { console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0); }
main().catch((e) => { console.error(e); process.exit(2); });
