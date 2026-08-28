// The two-step door: kiosk_options offers, kiosk_check_in_choice commits.
//
// Driven through the real HTTP endpoint, because the split lives there too —
// /api/scan means "what could I do?" without a session_id and "do this one"
// with it.
//
// Start the app first:  PORT=3111 npm run start
//   node scripts/test-kiosk-picker.mjs
//   KIOSK_BASE=https://dellys.md node scripts/test-kiosk-picker.mjs
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sweepTestData } from "./clean-test-data.mjs";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const BASE = process.env.KIOSK_BASE || "http://localhost:3111";

let pass = 0, fail = 0;
const log = (ok, name, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const iso = (min) => new Date(Date.now() + min * 60000).toISOString();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The door throttles a single IP to 15 requests per 10s — plenty for a real
// queue, far less than a test loop. Back off and retry rather than reporting a
// protection working as designed as a failure.
const post = async (body, attempt = 0) => {
  const r = await fetch(`${BASE}/api/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = { status: r.status, body: await r.json() };
  if (out.body?.code === "rate_limited" && attempt < 3) {
    await sleep(10_500);
    return post(body, attempt + 1);
  }
  return out;
};

async function main() {
  const { data: locs } = await db.from("locations").select("id,key");
  const HERE = locs.find((l) => l.key === "trandafirilor");
  const { data: device } = await db.from("kiosk_devices").select("token")
    .eq("location_id", HERE.id).eq("active", true).limit(1).single();
  const { data: adultCt } = await db.from("class_types").select("id").eq("audience", "adult").limit(1).single();
  const { data: kidCt } = await db.from("class_types").select("id").eq("audience", "child").limit(1).single();
  const planFor = async (aud) =>
    (await db.from("membership_plans").select("id").eq("audience", aud).eq("location_id", HERE.id)
      .is("system_key", null).eq("active", true).limit(1).single()).data;
  const adultPlan = await planFor("adult"), kidPlan = await planFor("child");

  const trash = { users: [], sessions: [] };
  const stamp = Date.now();
  const mkUser = async (tag, name) => {
    const { data } = await db.auth.admin.createUser({
      email: `zz-pick-${tag}-${stamp}@example.invalid`, email_confirm: true,
      user_metadata: { full_name: name ?? `Pick ${tag}` },
    });
    trash.users.push(data.user.id);
    await db.from("profiles").update({ location_id: HERE.id }).eq("id", data.user.id);
    const { data: p } = await db.from("profiles").select("qr_uuid").eq("id", data.user.id).single();
    return { id: data.user.id, qr: p.qr_uuid };
  };
  const mkSession = async (min, ct, cap = 8) => {
    const { data } = await db.from("sessions").insert({
      class_type_id: ct.id, starts_at: iso(min), duration_min: 60,
      capacity: cap, booked_count: 0, status: "scheduled", location_id: HERE.id,
    }).select("*").single();
    trash.sessions.push(data.id);
    return data;
  };
  const mkMem = async (uid, plan, n = 5) =>
    (await db.from("user_memberships").insert({
      user_id: uid, plan_id: plan.id, sessions_remaining: n,
      expires_at: new Date(Date.now() + 30 * 864e5).toISOString(),
      amount_paid: 100, payment_method: "cash",
    }).select("id").single()).data.id;
  const left = (id) =>
    db.from("user_memberships").select("sessions_remaining").eq("id", id).single()
      .then((r) => r.data.sessions_remaining);
  const ask = (qr) => post({ qr_uuid: qr, device_token: device.token });
  const tap = (qr, o) => post({ qr_uuid: qr, device_token: device.token, session_id: o.sessionId, child_id: o.childId });

  try {
    console.log("-- scanning offers a list and writes nothing --");
    const u = await mkUser("adult");
    const m = await mkMem(u.id, adultPlan);
    const s1 = await mkSession(10, adultCt);
    const s2 = await mkSession(40, adultCt);
    await mkSession(25, kidCt); // kids class: not payable by an adult bundle
    const r1 = await ask(u.qr);
    const mine = (res) => (res.body.options ?? []).filter((o) => o.sessionId === s1.id || o.sessionId === s2.id);
    log(r1.body.code === "options", "got options, not a check-in", `code=${r1.body.code}`);
    log(mine(r1).length === 2, "both adult classes offered", `n=${mine(r1).length}`);
    log(!(r1.body.options ?? []).some((o) => !o.payable), "nothing unpayable is offered");
    log((await left(m)) === 5, "asking costs nothing", `still ${await left(m)}`);

    console.log("\n-- tapping one checks into exactly that one --");
    const chosen = mine(r1).find((o) => o.sessionId === s2.id);
    const r2 = await tap(u.qr, chosen);
    log(r2.body.ok && r2.status === 200, "checked in", `code=${r2.body.code}`);
    log((await left(m)) === 4, "charged once", `5 -> ${await left(m)}`);
    const { data: bk } = await db.from("bookings").select("session_id,status").eq("user_id", u.id).eq("status", "attended");
    log(bk.length === 1 && bk[0].session_id === s2.id, "the class they tapped, not the nearest one");

    console.log("\n-- and the other class is still available afterwards --");
    const r3 = await ask(u.qr);
    log(mine(r3).length === 1 && mine(r3)[0].sessionId === s1.id, "the spent one drops off", `n=${mine(r3).length}`);
    const r4 = await tap(u.qr, mine(r3)[0]);
    log(r4.body.ok, "back-to-back classes now work", `code=${r4.body.code}`);

    console.log("\n-- a parent chooses WHICH child --");
    const p = await mkUser("parent", "Maria Popescu");
    const pm = await mkMem(p.id, kidPlan, 10);
    const { data: kids } = await db.from("children").insert([
      { parent_id: p.id, name: "Ana", birth_year: 2017 },
      { parent_id: p.id, name: "Luca", birth_year: 2015 },
    ]).select("id,name");
    const ks = await mkSession(15, kidCt);
    const forKs = (res) => (res.body.options ?? []).filter((o) => o.sessionId === ks.id);
    const p1 = await ask(p.qr);
    log(forKs(p1).length === 2, "one row per child", forKs(p1).map((o) => o.personName).join(", "));
    const luca = forKs(p1).find((o) => o.personName === "Luca");
    const p2 = await tap(p.qr, luca);
    log(p2.body.ok && p2.body.clientName === "Luca", "the tapped child goes in", `clientName=${p2.body.clientName}`);
    log(p2.body.parentName === "Maria Popescu", "parent named beside them");
    const p3 = await ask(p.qr);
    log(forKs(p3).length === 1 && forKs(p3)[0].personName === "Ana", "only the sibling remains", forKs(p3).map((o) => o.personName).join(","));
    log((await left(pm)) === 9, "one child, one session", `10 -> ${await left(pm)}`);

    console.log("\n-- guards, re-applied on the tap --");
    const stranger = await mkUser("stranger");
    await mkMem(stranger.id, kidPlan, 5);
    const steal = await post({ qr_uuid: stranger.qr, device_token: device.token, session_id: ks.id, child_id: kids[0].id });
    log(steal.body.code === "not_found", "cannot check in someone else's child", `code=${steal.body.code}`);

    const far = await mkSession(200, adultCt);
    const outside = await post({ qr_uuid: u.qr, device_token: device.token, session_id: far.id, child_id: null });
    log(outside.body.code === "no_class", "cannot tap a class outside the window", `code=${outside.body.code}`);

    const again = await post({ qr_uuid: u.qr, device_token: device.token, session_id: s1.id, child_id: null });
    log(again.body.code === "already_checked_in", "cannot enter the same class twice", `code=${again.body.code}`);

    const badDev = await post({ qr_uuid: u.qr, device_token: "deadbeefdeadbeefdeadbeefdeadbeef" });
    log(badDev.body.code === "device_unknown", "unknown tablet refused", `code=${badDev.body.code}`);

    console.log("\n-- an empty list still explains itself --");
    const broke = await mkUser("broke");
    const rb = await ask(broke.qr);
    log(rb.body.code === "no_membership" && !rb.body.options, "no bundle -> reason, not a blank screen", `code=${rb.body.code}`);

    console.log("");
    console.log("-- two seats in ONE confirm --");
    // A parent with two children walks through the door once, not twice.
    const mp = await mkUser("multi", "Elena Rusu");
    const mm = await mkMem(mp.id, kidPlan, 10);
    const { data: mkids } = await db.from("children").insert([
      { parent_id: mp.id, name: "Dan", birth_year: 2016 },
      { parent_id: mp.id, name: "Sofia", birth_year: 2014 },
    ]).select("id,name");
    const mks = await mkSession(18, kidCt);
    const mo = await ask(mp.qr);
    const both = (mo.body.options ?? []).filter((o) => o.sessionId === mks.id);
    log(both.length === 2, "both children offered", both.map((o) => o.personName).join(", "));
    const multi = await post({
      qr_uuid: mp.qr, device_token: device.token,
      picks: both.map((o) => ({ session_id: o.sessionId, child_id: o.childId })),
    });
    log(multi.body.ok && multi.body.admitted?.length === 2, "both admitted in one call",
      `admitted=${multi.body.admitted?.length} refused=${multi.body.refused?.length ?? 0}`);
    log((multi.body.admitted ?? []).map((r) => r.clientName).sort().join(",") === "Dan,Sofia",
      "both named", (multi.body.admitted ?? []).map((r) => r.clientName).join(", "));
    log((await left(mm)) === 8, "two seats, two sessions", `10 -> ${await left(mm)}`);
    const { data: mbk } = await db.from("bookings").select("child_id,status").eq("session_id", mks.id);
    log(mbk.length === 2 && mbk.every((b) => b.status === "attended"), "both bookings marked attended");
    const { data: msess } = await db.from("sessions").select("booked_count").eq("id", mks.id).single();
    log(msess.booked_count === 2, "seat count matches", `booked=${msess.booked_count}`);
    log(mkids.length === 2, "fixture sane");

    console.log("");
    console.log("-- a duplicate tap is one person, not two --");
    const dp = await mkUser("dupe");
    const dm = await mkMem(dp.id, adultPlan, 5);
    const ds = await mkSession(22, adultCt);
    const dupRes = await post({
      qr_uuid: dp.qr, device_token: device.token,
      picks: [{ session_id: ds.id, child_id: null }, { session_id: ds.id, child_id: null }],
    });
    log(dupRes.body.ok, "went through", `code=${dupRes.body.code}`);
    log((await left(dm)) === 4, "charged ONCE, not twice", `5 -> ${await left(dm)}`);

    console.log("");
    console.log("-- a partly-impossible selection reports both halves --");
    const pp = await mkUser("part");
    const pmem = await mkMem(pp.id, adultPlan, 5);
    const good = await mkSession(28, adultCt);
    const gone = await mkSession(32, adultCt, 1);
    const filler = await mkUser("filler");
    await mkMem(filler.id, adultPlan, 5);
    await post({ qr_uuid: filler.qr, device_token: device.token, session_id: gone.id, child_id: null });
    const partial = await post({
      qr_uuid: pp.qr, device_token: device.token,
      picks: [{ session_id: good.id, child_id: null }, { session_id: gone.id, child_id: null }],
    });
    log(partial.body.admitted?.length === 1 && partial.body.refused?.length === 1,
      "one in, one refused", `admitted=${partial.body.admitted?.length} refused=${partial.body.refused?.length}`);
    log(partial.body.refused?.[0]?.code === "class_full", "and says why", `code=${partial.body.refused?.[0]?.code}`);
    log((await left(pmem)) === 4, "only the one that worked was charged", `5 -> ${await left(pmem)}`);

    console.log("\n-- the last seat, two people, one instant --");
    const tight = await mkSession(0, adultCt, 1);
    const a = await mkUser("racea"), b = await mkUser("raceb");
    for (const x of [a, b]) await mkMem(x.id, adultPlan);
    const opt = { sessionId: tight.id, childId: null };
    const [ra, rb2] = await Promise.all([tap(a.qr, opt), tap(b.qr, opt)]);
    const okCount = [ra, rb2].filter((r) => r.body.ok).length;
    const { data: after } = await db.from("sessions").select("booked_count,capacity").eq("id", tight.id).single();
    log(okCount === 1 && after.booked_count <= after.capacity,
      "exactly one got in, no overbooking", `${okCount} admitted, ${after.booked_count}/${after.capacity}`);
  } finally {
    for (const s of trash.sessions) {
      await db.from("bookings").delete().eq("session_id", s);
      await db.from("sessions").delete().eq("id", s);
    }
    for (const u of trash.users) {
      await db.from("bookings").delete().eq("user_id", u);
      await db.from("user_memberships").delete().eq("user_id", u);
      await db.from("free_trial_usage").delete().eq("user_id", u);
      await db.from("children").delete().eq("parent_id", u);
      await db.auth.admin.deleteUser(u);
    }
    console.log(`\ncleaned up ${trash.users.length} accounts, ${trash.sessions.length} sessions`);
    // Belt and braces: a per-id delete can fail silently, and a survivor is
    // not inert — its membership shows up as revenue on the owner's
    // dashboard. Sweep by email pattern as well.
    await sweepTestData({ quiet: true });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
