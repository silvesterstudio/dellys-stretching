// The two edges of online self-service, against the live database.
//
//   * book_session   refuses inside 3 hours (BOOKING_CLOSED) and allows outside
//   * cancel_booking refuses inside 5 hours (CANCEL_CLOSED) and allows outside
//   * neither edge disturbs the rules that were already there
//   * the front desk is not caught by either (staff cancel stays open, and the
//     admin's own add/remove path never goes through these functions)
//
// Needs migration 0037 applied. Creates throwaway accounts and sessions under
// @example.invalid and sweeps them, whatever happens.
//
//   node scripts/test-booking-windows.mjs
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
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let pass = 0,
  fail = 0;
const log = (ok, name, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};
const inHours = (h) => new Date(Date.now() + h * 3600000).toISOString();
const code = (e) => (e ? String(e.message || e).toUpperCase() : "");

async function main() {
  const { data: locs } = await db.from("locations").select("id,key");
  const HERE = locs.find((l) => l.key === "trandafirilor");
  const { data: ct } = await db
    .from("class_types")
    .select("id")
    .eq("audience", "adult")
    .limit(1)
    .single();
  const { data: plan } = await db
    .from("membership_plans")
    .select("id, session_count, validity_days")
    .eq("audience", "adult")
    .eq("location_id", HERE.id)
    .is("system_key", null)
    .eq("active", true)
    .limit(1)
    .single();

  const trash = { users: [], sessions: [] };
  const stamp = Date.now();
  const pw = `Bw!${stamp}aA`;

  // A member with a password, so the RPCs run as a real authenticated user —
  // book_session reads auth.uid() and the service role would sail past RLS.
  const mkUser = async (tag, role = null) => {
    const email = `zz-bw-${tag}-${stamp}@example.invalid`;
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: pw,
      email_confirm: true,
      user_metadata: { full_name: `BW ${tag}` },
    });
    if (error) throw error;
    trash.users.push(data.user.id);
    const patch = { location_id: HERE.id };
    if (role) patch.role = role;
    await db.from("profiles").update(patch).eq("id", data.user.id);
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, anonKey, {
      auth: { persistSession: false },
    });
    const { error: signErr } = await client.auth.signInWithPassword({ email, password: pw });
    if (signErr) throw signErr;
    return { id: data.user.id, client };
  };

  const mkSession = async (hoursFromNow) => {
    const { data, error } = await db
      .from("sessions")
      .insert({
        class_type_id: ct.id,
        location_id: HERE.id,
        starts_at: inHours(hoursFromNow),
        duration_min: 60,
        capacity: 5,
        booked_count: 0,
        status: "scheduled",
      })
      .select("id")
      .single();
    if (error) throw error;
    trash.sessions.push(data.id);
    return data.id;
  };

  try {
    const member = await mkUser("member");
    // A PAID member — these rules are written for people who hold a bundle, and
    // without one book_session stops them at three open bookings instead.
    await db.from("user_memberships").insert({
      user_id: member.id,
      plan_id: plan.id,
      sessions_remaining: 20,
      starts_at: new Date().toISOString(),
      expires_at: inHours(24 * 30),
      frozen: false,
      amount_paid: 0,
    });

    console.log("-- booking: the 3-hour edge --");

    const soon = await mkSession(2);
    const soonRes = await member.client.rpc("book_session", { p_session_id: soon });
    log(code(soonRes.error).includes("BOOKING_CLOSED"), "2h out is refused", code(soonRes.error));

    const edge = await mkSession(2.9);
    const edgeRes = await member.client.rpc("book_session", { p_session_id: edge });
    log(
      code(edgeRes.error).includes("BOOKING_CLOSED"),
      "2h54m out is still refused",
      code(edgeRes.error),
    );

    const later = await mkSession(4);
    const laterRes = await member.client.rpc("book_session", { p_session_id: later });
    log(!laterRes.error && !!laterRes.data, "4h out goes through", laterRes.error?.message ?? "");

    const { data: refused } = await db
      .from("sessions")
      .select("booked_count")
      .in("id", [soon, edge]);
    log(
      refused.every((s) => s.booked_count === 0),
      "a refused booking holds no seat",
      refused.map((s) => s.booked_count).join(","),
    );

    console.log();
    console.log("-- cancelling: the 5-hour edge --");

    const bookingId = laterRes.data;
    const cancelSoon = await member.client.rpc("cancel_booking", { p_booking_id: bookingId });
    log(
      code(cancelSoon.error).includes("CANCEL_CLOSED"),
      "cancelling a class 4h away is refused",
      code(cancelSoon.error),
    );

    const { data: stillHeld } = await db
      .from("bookings")
      .select("status")
      .eq("id", bookingId)
      .single();
    log(stillHeld.status === "booked", "and the seat is still held", stillHeld.status);

    const far = await mkSession(30);
    const farBooking = await member.client.rpc("book_session", { p_session_id: far });
    log(!farBooking.error, "a class 30h away books", farBooking.error?.message ?? "");
    const cancelFar = await member.client.rpc("cancel_booking", {
      p_booking_id: farBooking.data,
    });
    log(!cancelFar.error && cancelFar.data === true, "and cancels", cancelFar.error?.message ?? "");

    const { data: freed } = await db
      .from("sessions")
      .select("booked_count")
      .eq("id", far)
      .single();
    log(freed.booked_count === 0, "the seat came back", String(freed.booked_count));

    console.log();
    console.log("-- the front desk is not caught by either --");

    // An admin cancelling on a member's behalf, inside the 5-hour window.
    // Admin, not reception: cancelling somebody else's booking has been
    // admin-only since 0016 (a destructive action), and 0037 did not widen it.
    const desk = await mkUser("desk", "admin");
    const deskSession = await mkSession(4);
    const deskBooking = await member.client.rpc("book_session", { p_session_id: deskSession });
    const deskCancel = await desk.client.rpc("cancel_booking", {
      p_booking_id: deskBooking.data,
    });
    log(
      !deskCancel.error && deskCancel.data === true,
      "staff can still free a seat 4h out",
      deskCancel.error?.message ?? "",
    );

    // The admin's own "add somebody to this class" path writes the row directly
    // through the service role, so a walk-in at the door is unaffected.
    const doorway = await mkSession(2);
    const walkIn = await db
      .from("bookings")
      .insert({ session_id: doorway, user_id: member.id, status: "booked" })
      .select("id")
      .single();
    log(!walkIn.error, "the desk can still add somebody to a class in 2h", walkIn.error?.message ?? "");

    console.log();
    console.log("-- the older rules still hold --");

    const past = await mkSession(-1);
    const pastRes = await member.client.rpc("book_session", { p_session_id: past });
    log(code(pastRes.error).includes("PAST_SESSION"), "a class that already ran", code(pastRes.error));

    const twice = await mkSession(12);
    const first = await member.client.rpc("book_session", { p_session_id: twice });
    const dup = await member.client.rpc("book_session", { p_session_id: twice });
    log(
      !first.error && code(dup.error).includes("ALREADY_BOOKED"),
      "a second booking for the same class is refused",
      code(dup.error) || "no error",
    );

    const full = await mkSession(10);
    await db.from("sessions").update({ booked_count: 5 }).eq("id", full);
    const fullRes = await member.client.rpc("book_session", { p_session_id: full });
    log(code(fullRes.error).includes("SESSION_FULL"), "a full class", code(fullRes.error));
  } finally {
    for (const id of trash.sessions) {
      await db.from("bookings").delete().eq("session_id", id);
      await db.from("sessions").delete().eq("id", id);
    }
    for (const id of trash.users) {
      await db.from("bookings").delete().eq("user_id", id);
      await db.from("user_memberships").delete().eq("user_id", id);
      await db.from("free_trial_usage").delete().eq("user_id", id);
      await db.from("children").delete().eq("parent_id", id);
      await db.auth.admin.deleteUser(id);
    }
    console.log(`
cleaned up ${trash.users.length} accounts, ${trash.sessions.length} sessions`);
    // A survivor is not inert — it shows up on the owner's dashboard. Sweep by
    // email pattern as well.
    await sweepTestData({ quiet: true });
  }

  console.log();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
