// End-to-end test of the transfer WRITE path against the real Supabase schema.
// 1. READ-ONLY: confirm the transfer_adult / transfer_child system plans exist
//    (a Prețuri reset would wipe them -> every transfer would fail).
// 2. ISOLATED WRITE: create a throwaway auth user (auto-gets a client profile),
//    run the exact insert transferMembershipAction does across scenarios, read
//    the balance back the way getMemberDetailAction does, then delete the user
//    (cascades away every trace). Nothing touches real accounts.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- load .env.local ---
const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const svc = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !svc) { console.error("Missing Supabase env"); process.exit(2); }
const db = createClient(url, svc, { auth: { autoRefreshToken: false, persistSession: false } });

let pass = 0, fail = 0;
const log = (ok, name, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}${detail ? "  — " + detail : ""}`); };

// Mirror the action: end-of-day Chisinau (approx +03 summer / +02 winter — the
// exact offset doesn't matter for verifying the row round-trips).
const endOfDayISO = (ymd) => new Date(`${ymd}T23:59:00+03:00`).toISOString();

// Mirror getMemberDetailAction's "usable/active" derivation.
const isUsable = (m, now = Date.now()) =>
  new Date(m.expires_at).getTime() > now && m.sessions_remaining > 0 && !m.frozen;

async function main() {
  console.log("── 1. System plans (ship-blocker read check) ─────────────────");
  const { data: plans, error: pErr } = await db
    .from("membership_plans")
    .select("id, audience, name_ro, active, price, system_key")
    .in("system_key", ["transfer_adult", "transfer_child"]);
  if (pErr) { log(false, "query system plans", pErr.message); return finish(); }
  const byKey = Object.fromEntries((plans ?? []).map((p) => [p.system_key, p]));
  log(!!byKey.transfer_adult, "transfer_adult plan exists", byKey.transfer_adult ? `id ${byKey.transfer_adult.id.slice(0, 8)} active=${byKey.transfer_adult.active} price=${byKey.transfer_adult.price}` : "MISSING — transfers will fail!");
  log(!!byKey.transfer_child, "transfer_child plan exists", byKey.transfer_child ? `id ${byKey.transfer_child.id.slice(0, 8)} active=${byKey.transfer_child.active} price=${byKey.transfer_child.price}` : "MISSING — child transfers will fail!");
  log(byKey.transfer_adult?.audience === "adult", "transfer_adult audience = adult");
  log(byKey.transfer_child?.audience === "child", "transfer_child audience = child");
  log(byKey.transfer_adult?.active === false, "transfer_adult inactive (hidden from sale page)");
  log(Number(byKey.transfer_adult?.price) === 0, "transfer_adult price 0 (out of revenue)");
  if (!byKey.transfer_adult || !byKey.transfer_child) return finish();

  console.log("\n── 2. Isolated write round-trip ──────────────────────────────");
  const stamp = Date.now();
  const email = `zz-transfer-test-${stamp}@example.invalid`;
  const { data: created, error: cErr } = await db.auth.admin.createUser({
    email, password: `Test!${stamp}aA`, email_confirm: true,
  });
  if (cErr || !created?.user) { log(false, "create throwaway user", cErr?.message); return finish(); }
  const uid = created.user.id;
  console.log(`   test user ${uid.slice(0, 8)} (${email})`);

  try {
    // trigger should have created a client profile
    const { data: prof } = await db.from("profiles").select("role").eq("id", uid).maybeSingle();
    log(prof?.role === "client", "auto-created profile with role=client", `role=${prof?.role}`);

    // Scenarios: [audience, sessionsRemaining, expiresOn(YYYY-MM-DD), label]
    // These are the OUTPUTS the client computes for representative cases.
    const scenarios = [
      { audience: "adult", sessions: 20, expiresOn: "2026-09-10", note: "Transfer · 2mo fresh" },       // 10/mo x 2
      { audience: "adult", sessions: 7,  expiresOn: "2026-08-10", note: "Transfer · 2mo used 3" },
      { audience: "child", sessions: 8,  expiresOn: "2026-08-01", note: "Transfer · child 1mo" },
      { audience: "adult", sessions: 999, expiresOn: "2026-08-10", note: "Transfer · unlimited" },
      { audience: "adult", sessions: 0,  expiresOn: "2026-08-10", note: "Transfer · zero balance" },     // edge: allowed
      { audience: "adult", sessions: 10, expiresOn: "2020-01-01", note: "Transfer · already expired" },  // edge: past expiry
    ];

    const insertedIds = [];
    for (const s of scenarios) {
      const plan = s.audience === "child" ? byKey.transfer_child : byKey.transfer_adult;
      const expires = endOfDayISO(s.expiresOn);
      const { data: ins, error: iErr } = await db
        .from("user_memberships")
        .insert({ user_id: uid, plan_id: plan.id, sessions_remaining: s.sessions, expires_at: expires, assigned_by: null, note: s.note })
        .select("id, sessions_remaining, expires_at")
        .single();
      if (iErr) { log(false, `insert [${s.note}]`, iErr.message); continue; }
      insertedIds.push(ins.id);
      const okSessions = ins.sessions_remaining === s.sessions;
      log(okSessions, `insert [${s.note}] sessions=${s.sessions}`, `stored ${ins.sessions_remaining}, exp ${ins.expires_at.slice(0, 10)}`);
    }

    // Constraint: negative sessions must be REJECTED (check sessions_remaining >= 0)
    const { error: negErr } = await db
      .from("user_memberships")
      .insert({ user_id: uid, plan_id: byKey.transfer_adult.id, sessions_remaining: -5, expires_at: endOfDayISO("2026-08-10") });
    log(!!negErr, "DB rejects negative sessions_remaining", negErr ? "rejected ✓" : "ACCEPTED — constraint missing!");

    // Read back the way the admin member page does, and derive usable/expired.
    const { data: mems } = await db
      .from("user_memberships")
      .select("sessions_remaining, expires_at, note, frozen, plan:membership_plans(name_ro, system_key)")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    log((mems?.length ?? 0) === scenarios.length, `member has ${scenarios.length} membership rows`, `found ${mems?.length}`);

    const zero = mems.find((m) => m.note.includes("zero balance"));
    log(zero && !isUsable(zero), "zero-balance membership is NOT usable");
    const expired = mems.find((m) => m.note.includes("already expired"));
    log(expired && !isUsable(expired), "past-expiry membership is NOT usable");
    const good = mems.find((m) => m.note.includes("2mo fresh"));
    log(good && isUsable(good), "fresh 20-session membership IS usable");
    const unl = mems.find((m) => m.note.includes("unlimited"));
    log(unl && unl.sessions_remaining === 999 && isUsable(unl), "unlimited (999) membership IS usable");
    log(mems.every((m) => m.plan?.system_key?.startsWith("transfer_")), "all rows hang off a transfer_* system plan (off revenue)");

  } finally {
    // ── Teardown: delete the auth user; ON DELETE CASCADE clears profile + memberships.
    const { error: dErr } = await db.auth.admin.deleteUser(uid);
    log(!dErr, "teardown: delete throwaway user (cascade)", dErr?.message || "clean");
    const { data: leftover } = await db.from("user_memberships").select("id").eq("user_id", uid);
    log((leftover?.length ?? 0) === 0, "teardown: no membership rows left behind", `remaining ${leftover?.length ?? 0}`);
    const { data: profGone } = await db.from("profiles").select("id").eq("id", uid).maybeSingle();
    log(!profGone, "teardown: profile removed");
  }
  finish();
}

function finish() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
