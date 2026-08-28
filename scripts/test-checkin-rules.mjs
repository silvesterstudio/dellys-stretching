// Every branch of the front door, against the live schema, with throwaway data.
//
// Covers what changed in 0032 — no free session at the door, children named and
// counted, one round trip — plus the rules that must NOT have moved: capacity,
// double-spend, wrong studio, frozen/expired bundles.
//
// Start the app first (the HTTP half needs it):  PORT=3111 npm run start
//   node scripts/test-checkin-rules.mjs
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
const scan = (qr, loc) => db.rpc("kiosk_scan", { p_qr: qr, p_location: loc, p_device: null }).then((r) => r.data);

async function main() {
  const { data: locs } = await db.from("locations").select("id,key,name").order("sort_order");
  const HERE = locs.find((l) => l.key === "trandafirilor");
  const OTHER = locs.find((l) => l.key === "moscova");
  const { data: adultCt } = await db.from("class_types").select("id,category").eq("audience", "adult").limit(1).single();
  const { data: kidCt } = await db.from("class_types").select("id,category").eq("audience", "child").limit(1).single();
  const planFor = async (aud) =>
    (await db.from("membership_plans").select("id").eq("audience", aud).eq("location_id", HERE.id)
      .is("system_key", null).eq("active", true).limit(1).single()).data;
  const adultPlan = await planFor("adult"), kidPlan = await planFor("child");
  const { data: device } = await db.from("kiosk_devices").select("token").eq("location_id", HERE.id).eq("active", true).limit(1).single();

  const trash = { users: [], sessions: [] };
  const stamp = Date.now();
  const mkUser = async (tag, locId = HERE.id, name = `CI ${tag}`) => {
    const { data } = await db.auth.admin.createUser({
      email: `zz-rules-${tag}-${stamp}@example.invalid`, email_confirm: true, user_metadata: { full_name: name },
    });
    trash.users.push(data.user.id);
    await db.from("profiles").update({ location_id: locId }).eq("id", data.user.id);
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
  const mkMem = async (uid, plan, { sessions = 5, days = 30, frozen = false } = {}) =>
    (await db.from("user_memberships").insert({
      user_id: uid, plan_id: plan.id, sessions_remaining: sessions,
      expires_at: new Date(Date.now() + days * 864e5).toISOString(), frozen,
      amount_paid: 100, payment_method: "cash",
    }).select("id").single()).data.id;
  const remaining = async (id) =>
    (await db.from("user_memberships").select("sessions_remaining").eq("id", id).single()).data.sessions_remaining;

  try {
    console.log("── no membership means no entry (the free session is gone) ──");
    const u0 = await mkUser("free");
    await mkSession(5, adultCt);
    const r0 = await scan(u0.qr, HERE.id);
    log(r0.code === "no_membership" && !r0.ok, "refused with no bundle", `code=${r0.code}`);
    const { count: ftu } = await db.from("free_trial_usage").select("user_id", { count: "exact", head: true }).eq("user_id", u0.id);
    log(ftu === 0, "and nothing was consumed on their behalf", `free_trial_usage rows=${ftu}`);

    console.log("\n── an ordinary member still gets in ──");
    const u1 = await mkUser("ok");
    const m1 = await mkMem(u1.id, adultPlan);
    const r1 = await scan(u1.qr, HERE.id);
    log(r1.ok && r1.walkIn, "walk-in admitted", `class=${r1.className_ro}`);
    log((await remaining(m1)) === 4, "charged once", `5 -> ${await remaining(m1)}`);
    log(r1.parentName == null, "no parent line for an adult", `parentName=${r1.parentName}`);
    log(r1.alsoBooked === 0, "nobody else waiting on this QR", `alsoBooked=${r1.alsoBooked}`);

    console.log("\n── two children, one parent, one QR ──");
    const p2 = await mkUser("parent", HERE.id, "Maria Popescu");
    const m2 = await mkMem(p2.id, kidPlan, { sessions: 10 });
    const { data: kids } = await db.from("children").insert([
      { parent_id: p2.id, name: "Ana", birth_year: 2017 },
      { parent_id: p2.id, name: "Luca", birth_year: 2015 },
    ]).select("id,name");
    const ks = await mkSession(8, kidCt);
    await db.from("bookings").insert(kids.map((k) => ({ session_id: ks.id, user_id: p2.id, child_id: k.id, status: "booked" })));
    await db.from("sessions").update({ booked_count: 2 }).eq("id", ks.id);

    const a = await scan(p2.qr, HERE.id);
    log(kids.some((k) => k.name === a.clientName), "the CHILD is named, not the parent", `clientName=${a.clientName}`);
    log(a.parentName === "Maria Popescu", "parent shown beside them", `parentName=${a.parentName}`);
    log(a.alsoBooked === 1, "screen says one more child to scan", `alsoBooked=${a.alsoBooked}`);

    const b = await scan(p2.qr, HERE.id);
    log(b.ok && b.clientName !== a.clientName, "second scan admits the other child", `${a.clientName} then ${b.clientName}`);
    log(b.alsoBooked === 0, "and now nobody is waiting", `alsoBooked=${b.alsoBooked}`);
    log((await remaining(m2)) === 8, "two children, two sessions", `10 -> ${await remaining(m2)}`);

    console.log("\n── a walk-in child is attributed when there is only one ──");
    const p3 = await mkUser("solo", HERE.id, "Ion Rusu");
    await mkMem(p3.id, kidPlan, { sessions: 5 });
    const { data: only } = await db.from("children").insert({ parent_id: p3.id, name: "Sofia", birth_year: 2016 }).select("id,name").single();
    await mkSession(6, kidCt);
    const r3 = await scan(p3.qr, HERE.id);
    log(r3.clientName === "Sofia", "named the only child", `clientName=${r3.clientName}`);
    const { data: bk } = await db.from("bookings").select("child_id").eq("user_id", p3.id).eq("status", "attended");
    log(bk.some((x) => x.child_id === only.id), "attendance recorded against the child, not NULL");

    console.log("\n-- an ADULT bundle in front of a KIDS class --");
    // Exactly what happened on the tablet: a valid adult membership, and the
    // only class running was Gimnastica. The door must refuse, but it must not
    // claim the member has no membership.
    // Isolate it: retire this run's own sessions so the only thing in the
    // walk-in window is a kids class. Otherwise the member correctly walks into
    // an adult class left over from an earlier case and the test lies.
    for (const id of trash.sessions) await db.from("sessions").update({ status: "cancelled" }).eq("id", id);
    const ua = await mkUser("wrongaud");
    await mkMem(ua.id, adultPlan, { sessions: 3 });
    await mkSession(3, kidCt);
    // A real adult class on the studio's timetable would do the same, so check.
    const { data: adultNow } = await db.from("sessions")
      .select("id, class_type:class_types(audience)")
      .eq("location_id", HERE.id).eq("status", "scheduled")
      .gte("starts_at", new Date(Date.now() - 20 * 60000).toISOString())
      .lte("starts_at", new Date(Date.now() + 45 * 60000).toISOString());
    const adultInWindow = adultNow.filter((r) => {
      const c = Array.isArray(r.class_type) ? r.class_type[0] : r.class_type;
      return c?.audience === "adult";
    }).length;
    if (adultInWindow) {
      console.log(`  (skipped — ${adultInWindow} real adult class(es) running now, cannot isolate)`);
    } else {
      const ra = await scan(ua.qr, HERE.id);
      log(ra.code === "wrong_audience", "refused as wrong_audience, not no_membership", `code=${ra.code}`);
      log(ra.className_ro && ra.className_ro !== "Pilates", "and names the KIDS class that is running", `class=${ra.className_ro}`);
    }

    console.log("\n-- with a RESERVATION for a class the bundle cannot pay --");
    const ub = await mkUser("wrongaud2");
    await mkMem(ub.id, adultPlan, { sessions: 3 });
    const kb = await mkSession(7, kidCt);
    await db.from("bookings").insert({ session_id: kb.id, user_id: ub.id, status: "booked" });
    await db.from("sessions").update({ booked_count: 1 }).eq("id", kb.id);
    const rb = await scan(ub.qr, HERE.id);
    log(rb.code === "wrong_audience", "same verdict on the reservation path", `code=${rb.code}`);

    console.log("\n-- and someone with NOTHING still gets no_membership --");
    const uc = await mkUser("nothing");
    await mkSession(9, kidCt);
    const rc = await scan(uc.qr, HERE.id);
    log(rc.code === "no_membership", "no bundle at all is still no_membership", `code=${rc.code}`);

    console.log("\n── rules that must not have moved ──");
    const r1b = await scan(u1.qr, HERE.id);
    log(r1b.code === "already_checked_in", "double scan still refused", `code=${r1b.code}`);

    const uf = await mkUser("frozen");
    await mkMem(uf.id, adultPlan, { frozen: true });
    log((await scan(uf.qr, HERE.id)).code === "no_membership", "frozen bundle does not pay");

    const ue = await mkUser("expired");
    await mkMem(ue.id, adultPlan, { days: -1 });
    log((await scan(ue.qr, HERE.id)).code === "no_membership", "expired bundle does not pay");

    const uo = await mkUser("elsewhere", OTHER.id);
    await mkMem(uo.id, adultPlan);
    const ro = await scan(uo.qr, HERE.id);
    log(ro.code === "wrong_location", "wrong studio refused", `home=${ro.homeLocation}`);

    log((await scan("nope-not-a-qr", HERE.id)).code === "not_found", "unknown QR refused");

    console.log("\n── the HTTP door: one call, tablet resolved inside ──");
    const post = async (body) =>
      fetch(`${BASE}/api/scan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then(async (r) => ({ status: r.status, body: await r.json() }));
    const uh = await mkUser("http");
    const mh = await mkMem(uh.id, adultPlan);
    await mkSession(4, adultCt);
    // Two steps now (0034): asking is free, tapping commits. The picker suite
    // covers the choosing in depth — this only proves the endpoint still wires
    // both halves together.
    const h1 = await post({ qr_uuid: uh.qr, device_token: device.token });
    log(h1.status === 200 && h1.body.code === "options" && h1.body.options?.length,
      "a real member is offered their classes", `HTTP ${h1.status} n=${h1.body.options?.length}`);
    log((await remaining(mh)) === 5, "asking costs nothing", `still ${await remaining(mh)}`);
    const h1b = await post({
      qr_uuid: uh.qr, device_token: device.token,
      session_id: h1.body.options[0].sessionId, child_id: h1.body.options[0].childId,
    });
    log(h1b.status === 200 && h1b.body.ok, "tapping one checks them in", `code=${h1b.body.code}`);
    log((await remaining(mh)) === 4, "charged once via HTTP", `5 -> ${await remaining(mh)}`);
    const h2 = await post({ qr_uuid: uh.qr, device_token: "deadbeefdeadbeefdeadbeefdeadbeef" });
    log(h2.body.code === "device_unknown", "unknown tablet refused inside the RPC", `code=${h2.body.code}`);
    const { data: dev } = await db.from("kiosk_devices").select("last_seen_at").eq("token", device.token).single();
    log(dev.last_seen_at && Date.now() - new Date(dev.last_seen_at).getTime() < 120000, "heartbeat stamped by the same call");
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
