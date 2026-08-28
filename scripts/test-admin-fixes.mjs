// The three front-desk fixes, against the live schema.
//
//   1. Reception can create accounts back to back (no email is sent).
//   2. Remaining sessions can be set to any exact figure, up or down.
//   3. A membership can start later, and until then it pays for nothing.
//
//   node scripts/test-admin-fixes.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let pass = 0, fail = 0;
const log = (ok, name, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const iso = (min) => new Date(Date.now() + min * 60000).toISOString();
const days = (n) => new Date(Date.now() + n * 864e5).toISOString();

async function main() {
  const { data: locs } = await db.from("locations").select("id,key");
  const HERE = locs.find((l) => l.key === "trandafirilor");
  const { data: dev } = await db.from("kiosk_devices").select("token")
    .eq("location_id", HERE.id).eq("active", true).limit(1).single();
  const { data: ct } = await db.from("class_types").select("id").eq("audience", "adult").limit(1).single();
  const { data: plan } = await db.from("membership_plans").select("id, validity_days, session_count")
    .eq("audience", "adult").eq("location_id", HERE.id).is("system_key", null).eq("active", true).limit(1).single();

  const trash = { users: [], sessions: [] };
  const stamp = Date.now();
  const mk = async (tag) => {
    const { data } = await db.auth.admin.createUser({
      email: `zz-af-${tag}-${stamp}@example.invalid`, email_confirm: true,
      user_metadata: { full_name: `AF ${tag}` },
    });
    trash.users.push(data.user.id);
    await db.from("profiles").update({ location_id: HERE.id }).eq("id", data.user.id);
    const { data: p } = await db.from("profiles").select("qr_uuid").eq("id", data.user.id).single();
    return { id: data.user.id, qr: p.qr_uuid };
  };

  try {
    console.log("-- 1. accounts back to back, no email --");
    // The admin path the new action uses. Six in a row: the built-in mailer
    // allows two an hour, so any of these sending mail would fail.
    const made = [];
    let createErr = null;
    for (let i = 0; i < 6; i++) {
      const { data, error } = await db.auth.admin.createUser({
        email: `zz-af-bulk-${i}-${stamp}@example.invalid`, email_confirm: true,
        user_metadata: { full_name: `Bulk ${i}`, phone: `0690000${i}` },
      });
      if (error) createErr = error.message;
      if (data?.user) { made.push(data.user.id); trash.users.push(data.user.id); }
    }
    log(made.length === 6 && !createErr, "six accounts created in a row", createErr ?? `${made.length}/6`);
    const { data: profs } = await db.from("profiles").select("id,qr_uuid").in("id", made);
    log(profs.length === 6 && profs.every((p) => p.qr_uuid),
      "each got a profile and a door QR straight away", `${profs.length} with QR`);

    // And the path that was failing, for contrast.
    const { error: otpErr } = await anon.auth.signInWithOtp({
      email: `zz-af-otp-${stamp}@example.invalid`,
      options: { shouldCreateUser: true },
    });
    log(!!otpErr, "the emailing signup path is still the rate-limited one", otpErr?.message ?? "(no error - limit may have reset)");

    console.log("");
    console.log("-- 2. sessions up AND down --");
    const u = await mk("sess");
    const { data: mem } = await db.from("user_memberships").insert({
      user_id: u.id, plan_id: plan.id, sessions_remaining: 8,
      expires_at: days(30), amount_paid: 700, payment_method: "cash",
    }).select("id").single();
    const setTo = async (n) => {
      await db.from("user_memberships").update({ sessions_remaining: n }).eq("id", mem.id);
      return (await db.from("user_memberships").select("sessions_remaining").eq("id", mem.id).single()).data.sessions_remaining;
    };
    log((await setTo(12)) === 12, "raised 8 -> 12");
    log((await setTo(3)) === 3, "lowered 12 -> 3");
    log((await setTo(0)) === 0, "down to zero");
    const { error: negErr } = await db.from("user_memberships")
      .update({ sessions_remaining: -1 }).eq("id", mem.id);
    log(!!negErr, "the database still refuses a negative balance", negErr?.message?.slice(0, 60) ?? "NO ERROR (bad)");

    console.log("");
    console.log("-- 3. a membership that starts later --");
    const f = await mk("future");
    const { data: fm } = await db.from("user_memberships").insert({
      user_id: f.id, plan_id: plan.id, sessions_remaining: 10,
      starts_at: days(7), expires_at: days(37), amount_paid: 700, payment_method: "cash",
    }).select("id, starts_at").single();
    log(new Date(fm.starts_at) > new Date(), "stored with a future start", fm.starts_at.slice(0, 10));

    const { data: s } = await db.from("sessions").insert({
      class_type_id: ct.id, starts_at: iso(10), duration_min: 60,
      capacity: 8, booked_count: 0, status: "scheduled", location_id: HERE.id,
    }).select("*").single();
    trash.sessions.push(s.id);

    const opts = (await db.rpc("kiosk_options", { p_qr: f.qr, p_device_token: dev.token })).data;
    log(opts.code === "no_membership", "the door offers nothing", `code=${opts.code}`);
    const tap = (await db.rpc("kiosk_check_in_choice", {
      p_qr: f.qr, p_device_token: dev.token, p_session: s.id, p_child: null,
    })).data;
    log(!tap.ok, "and refuses a direct tap", `code=${tap.code}`);
    const legacy = (await db.rpc("kiosk_scan", { p_qr: f.qr, p_location: HERE.id, p_device: null })).data;
    log(!legacy.ok, "the older scan path refuses too", `code=${legacy.code}`);
    const untouched = (await db.from("user_memberships").select("sessions_remaining").eq("id", fm.id).single()).data;
    log(untouched.sessions_remaining === 10, "nothing was spent", `${untouched.sessions_remaining}/10`);

    // The member's own "can I book" cap probe (book_session) must agree.
    const { data: capProbe } = await db.from("user_memberships")
      .select("id").eq("user_id", f.id).lte("starts_at", new Date().toISOString())
      .gt("expires_at", new Date().toISOString()).gt("sessions_remaining", 0);
    log((capProbe ?? []).length === 0, "and it does not count as a held bundle");

    console.log("");
    console.log("-- once it starts, it behaves normally --");
    await db.from("user_memberships").update({ starts_at: days(-1) }).eq("id", fm.id);
    const opts2 = (await db.rpc("kiosk_options", { p_qr: f.qr, p_device_token: dev.token })).data;
    log(opts2.code === "options", "now offered", `code=${opts2.code}`);
    const tap2 = (await db.rpc("kiosk_check_in_choice", {
      p_qr: f.qr, p_device_token: dev.token, p_session: s.id, p_child: null,
    })).data;
    log(tap2.ok && tap2.sessionsRemaining === 9, "and pays", `left=${tap2.sessionsRemaining}`);

    console.log("");
    console.log("-- existing memberships were not disturbed --");
    const { data: all } = await db.from("user_memberships").select("starts_at, created_at");
    const sane = all.filter((r) => new Date(r.starts_at) <= new Date(r.created_at).getTime() + 2000);
    log(sane.length === all.length, "every pre-existing bundle starts no later than its sale", `${all.length} rows`);
  } finally {
    for (const s of trash.sessions) {
      await db.from("bookings").delete().eq("session_id", s);
      await db.from("sessions").delete().eq("id", s);
    }
    for (const u of trash.users) {
      await db.from("bookings").delete().eq("user_id", u);
      await db.from("user_memberships").delete().eq("user_id", u);
      await db.from("free_trial_usage").delete().eq("user_id", u);
      await db.auth.admin.deleteUser(u);
    }
    const { data: { users } } = await db.auth.admin.listUsers({ perPage: 1000 });
    for (const u of users) if (/zz-af-otp-/.test(u.email ?? "")) await db.auth.admin.deleteUser(u.id);
    console.log(`\ncleaned up ${trash.users.length} accounts, ${trash.sessions.length} sessions`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
