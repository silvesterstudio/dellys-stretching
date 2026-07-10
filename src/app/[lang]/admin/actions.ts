"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { bucharestWallToUtc } from "@/lib/week";
import { weekdayInTz, wallTimeInTz } from "@/lib/format";

// All actions re-verify admin server-side (defense in depth) and rely on RLS
// (is_admin()) for the actual writes. They return a string error code or null.

type ActionResult = { error: string | null };

// Append an audit-log row. Best-effort: logging must never break the action it
// records, so failures are swallowed. Writes via the service role (RLS-bypassing)
// after the caller has already been verified.
async function logAudit(
  actor: { id: string; email: string },
  action: string,
  targetType: string | null,
  targetId: string | null,
  detail?: Record<string, unknown>,
): Promise<void> {
  try {
    const service = createAdminClient();
    await service.from("audit_log").insert({
      actor_id: actor.id,
      actor_email: actor.email,
      action,
      target_type: targetType,
      target_id: targetId,
      detail: detail ?? null,
    });
  } catch {
    /* ignore */
  }
}

export async function checkInAction(
  bookingId: string,
  membershipId: string | null,
): Promise<ActionResult> {
  const actor = await requireStaff();
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_in_booking", {
    p_booking_id: bookingId,
    p_membership_id: membershipId,
  });
  if (!error) {
    await logAudit(actor, "checkin.attend", "booking", bookingId, {
      membershipId,
    });
  }
  revalidatePath("/[lang]/admin/sessions/[id]", "page");
  return { error: error?.message ?? null };
}

export async function markNoShowAction(bookingId: string): Promise<ActionResult> {
  const actor = await requireStaff();
  let service;
  try {
    service = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }
  // Only a still-open booking can be marked no-show. Guarding on status stops a
  // stale/concurrent click from flipping an already-"attended" row to no_show,
  // which would strand the deducted session (undo only refunds "attended").
  const { data, error } = await service
    .from("bookings")
    .update({ status: "no_show" })
    .eq("id", bookingId)
    .in("status", ["booked", "pending"])
    .select("id");
  if (error) return { error: error.message };
  if (!data || data.length === 0) return { error: "NOT_CHECKINABLE" };
  await logAudit(actor, "checkin.no_show", "booking", bookingId);
  revalidatePath("/[lang]/admin/sessions/[id]", "page");
  return { error: null };
}

// Walk-in check-in: attend a client who didn't pre-book. We create the booking
// (via the service role, updating booked_count the way book_session does), then
// reuse the audited check_in_booking RPC through the admin's own session so the
// membership validation + deduction path is identical to a normal check-in.
export async function walkInCheckInAction(
  sessionId: string,
  userId: string,
  membershipId: string | null,
): Promise<ActionResult> {
  const actor = await requireStaff();
  let service;
  try {
    service = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }

  // Session must exist and be a real scheduled class.
  const { data: sess } = await service
    .from("sessions")
    .select("id, status, booked_count")
    .eq("id", sessionId)
    .maybeSingle();
  if (!sess) return { error: "SESSION_NOT_FOUND" };
  if (sess.status !== "scheduled") return { error: "SESSION_CANCELLED" };

  // If this client is already on the roster, just check that existing booking in
  // instead of creating a duplicate (bookings_active_uniq would reject it anyway).
  const { data: existing } = await service
    .from("bookings")
    .select("id, status")
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .in("status", ["pending", "booked", "no_show", "attended"])
    .maybeSingle();

  let bookingId = existing?.id as string | undefined;
  if (existing?.status === "attended") return { error: "ALREADY_ATTENDED" };

  if (!bookingId) {
    const { data: ins, error: insErr } = await service
      .from("bookings")
      .insert({ session_id: sessionId, user_id: userId, status: "booked" })
      .select("id")
      .single();
    if (insErr || !ins) return { error: "BOOKING_FAILED" };
    bookingId = ins.id as string;
    // Keep occupancy in sync (book_session does this atomically; we're the only
    // writer at the desk, so a direct increment is safe enough here).
    await service
      .from("sessions")
      .update({ booked_count: (sess.booked_count as number) + 1 })
      .eq("id", sessionId);
  }

  // Deduct + mark attended through the admin's authenticated session so
  // check_in_booking's is_admin() gate and audience/expiry checks apply.
  const rls = await createClient();
  const { error } = await rls.rpc("check_in_booking", {
    p_booking_id: bookingId,
    p_membership_id: membershipId,
  });
  if (error) {
    // Roll back a booking we just created so a failed deduction leaves no trace.
    if (!existing) {
      await service.from("bookings").delete().eq("id", bookingId);
      await service
        .from("sessions")
        .update({ booked_count: sess.booked_count as number })
        .eq("id", sessionId);
    }
    return { error: error.message };
  }
  await logAudit(actor, "checkin.walkin", "booking", bookingId, { userId, membershipId });
  revalidatePath("/[lang]/admin/sessions/[id]", "page");
  return { error: null };
}

// Export all client members as CSV (name, phone, email, joined, and their best
// active membership). Returned as a string; the browser turns it into a file.
export async function exportMembersCsvAction(): Promise<{ csv: string | null }> {
  await requireAdmin();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { csv: null };
  }
  const [{ data: members }, { data: mems }] = await Promise.all([
    admin
      .from("profiles")
      .select("id, full_name, email, phone, created_at")
      .eq("role", "client")
      .order("created_at", { ascending: false }),
    admin
      .from("user_memberships")
      .select("user_id, sessions_remaining, expires_at, frozen"),
  ]);

  // Best active membership per member: unexpired, has sessions, not frozen;
  // pick the one expiring latest.
  const now = Date.now();
  const best = new Map<string, { sessions: number; expires: string }>();
  for (const m of (mems ?? []) as Record<string, unknown>[]) {
    if (m.frozen) continue;
    const exp = m.expires_at as string;
    if (new Date(exp).getTime() <= now) continue;
    if ((m.sessions_remaining as number) <= 0) continue;
    const uid = m.user_id as string;
    const cur = best.get(uid);
    if (!cur || exp > cur.expires) best.set(uid, { sessions: m.sessions_remaining as number, expires: exp });
  }

  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const iso = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 10) : "");
  const header = ["Name", "Phone", "Email", "Joined", "Active sessions", "Expires"];
  const lines = [header.map(esc).join(",")];
  for (const p of (members ?? []) as Record<string, unknown>[]) {
    const b = best.get(p.id as string);
    lines.push(
      [
        esc((p.full_name as string) ?? ""),
        esc((p.phone as string) ?? ""),
        esc((p.email as string) ?? ""),
        esc(iso(p.created_at as string)),
        esc(b ? String(b.sessions) : "0"),
        esc(b ? iso(b.expires) : ""),
      ].join(","),
    );
  }
  return { csv: lines.join("\r\n") };
}

// Usable memberships for a member, matching a class audience — for the walk-in
// check-in picker (mirrors the roster page's membership query).
export async function getUsableMembershipsAction(
  userId: string,
  audience: "adult" | "child",
  lang: "ro" | "ru" = "ro",
): Promise<{ id: string; label: string }[]> {
  await requireStaff();
  let service;
  try {
    service = createAdminClient();
  } catch {
    return [];
  }
  const { data } = await service
    .from("user_memberships")
    .select(
      "id, sessions_remaining, plan:membership_plans!inner ( name_ro, name_ru, audience )",
    )
    .eq("user_id", userId)
    .eq("plan.audience", audience)
    .eq("frozen", false)
    .gt("sessions_remaining", 0)
    .gt("expires_at", new Date().toISOString());
  return (data ?? []).map((m: Record<string, unknown>) => {
    const plan = pickOne(m.plan as never) as { name_ro: string; name_ru: string } | null;
    const name = plan ? (lang === "ru" ? plan.name_ru : plan.name_ro) : "—";
    return { id: m.id as string, label: `${name} · ${m.sessions_remaining}` };
  });
}

// Undo a check-in: revert an attended booking to "booked" and refund the session
// that was deducted (if any). The seat stays held, so booked_count is unchanged.
export async function undoCheckInAction(bookingId: string): Promise<ActionResult> {
  const actor = await requireStaff();
  let service;
  try {
    service = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }
  const { data: booking } = await service
    .from("bookings")
    .select("id, status, membership_id, user_id, session_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { error: "NOT_FOUND" };
  // Reverts a wrong "attended" (refunding the session) or a wrong "no-show".
  if (booking.status !== "attended" && booking.status !== "no_show") {
    return { error: "NOT_UNDOABLE" };
  }
  const wasAttended = booking.status === "attended";

  // Refund the deducted session (only an "attended" check-in deducts one).
  if (wasAttended && booking.membership_id) {
    const { data: mem } = await service
      .from("user_memberships")
      .select("sessions_remaining")
      .eq("id", booking.membership_id as string)
      .maybeSingle();
    if (mem) {
      await service
        .from("user_memberships")
        .update({ sessions_remaining: (mem.sessions_remaining as number) + 1 })
        .eq("id", booking.membership_id as string);
    }
  }
  const { error } = await service
    .from("bookings")
    .update({ status: "booked", membership_id: null })
    .eq("id", bookingId);

  // check_in_booking stamps the category free-trial on first attendance. If this
  // undo removed the member's ONLY attendance in that category, release the
  // trial so their genuine first session is still free.
  if (!error && wasAttended && booking.session_id) {
    const { data: sess } = await service
      .from("sessions")
      .select("class_type:class_types ( category )")
      .eq("id", booking.session_id as string)
      .maybeSingle();
    const ct = sess
      ? (Array.isArray(sess.class_type) ? sess.class_type[0] : sess.class_type)
      : null;
    const category = (ct as { category: string | null } | null)?.category ?? null;
    if (category) {
      const { data: others } = await service
        .from("bookings")
        .select("id, session:sessions!inner ( class_type:class_types!inner ( category ) )")
        .eq("user_id", booking.user_id as string)
        .eq("status", "attended")
        .eq("session.class_type.category", category)
        .limit(1);
      if (!others || others.length === 0) {
        await service
          .from("free_trial_usage")
          .delete()
          .eq("user_id", booking.user_id as string)
          .eq("category", category);
      }
    }
  }
  if (!error) {
    await logAudit(actor, "checkin.undo", "booking", bookingId, {
      refunded: booking.status === "attended" && !!booking.membership_id,
    });
  }
  revalidatePath("/[lang]/admin/sessions/[id]", "page");
  return { error: error?.message ?? null };
}

const PAYMENT_METHODS = ["cash", "card", "transfer", "free"] as const;

export async function assignMembershipAction(
  userId: string,
  planId: string,
  note: string | null,
  payment?: { amount: number | null; method: string | null },
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  // Validate the target is a real client and the plan is active before writing.
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!target || target.role !== "client") return { error: "USER_NOT_FOUND" };

  const { data: plan, error: planErr } = await supabase
    .from("membership_plans")
    .select("session_count, validity_days, active, price")
    .eq("id", planId)
    .single();
  if (planErr || !plan) return { error: "PLAN_NOT_FOUND" };
  if (!plan.active) return { error: "PLAN_INACTIVE" };

  const expires = new Date(
    Date.now() + plan.validity_days * 86400000,
  ).toISOString();

  // Default to the plan's list price paid in cash if the admin didn't override.
  const method =
    payment?.method && PAYMENT_METHODS.includes(payment.method as never)
      ? payment.method
      : "cash";
  const rawAmount = payment?.amount;
  // A comped ("free") membership collects nothing, regardless of the prefilled
  // amount — otherwise it would book phantom revenue.
  const amountPaid =
    method === "free"
      ? 0
      : rawAmount != null && Number.isFinite(rawAmount) && rawAmount >= 0
        ? rawAmount
        : Number(plan.price) || 0;

  const { error } = await supabase.from("user_memberships").insert({
    user_id: userId,
    plan_id: planId,
    sessions_remaining: plan.session_count,
    expires_at: expires,
    assigned_by: admin.id,
    note,
    amount_paid: amountPaid,
    payment_method: method,
  });
  if (!error) {
    await logAudit(admin, "membership.assign", "member", userId, {
      planId,
      amountPaid,
      method,
    });
  }
  revalidatePath("/[lang]/admin/members", "page");
  revalidatePath("/[lang]/admin/dashboard", "page");
  // Don't leak raw Postgres error text (table/constraint names) to the client.
  return { error: error ? "ASSIGN_FAILED" : null };
}

// Transfer an EXISTING (offline) membership onto a member's account with a
// custom remaining-session count and expiry. Unlike assignMembershipAction —
// which sells a fresh catalog plan at full session count starting today — this
// hangs the balance off the hidden per-audience "transferred" system plan
// (system_key = transfer_adult / transfer_child, price 0, inactive), so it
// stays out of revenue totals and the public price list.
export async function transferMembershipAction(
  userId: string,
  input: {
    audience: "adult" | "child";
    sessionsRemaining: number; // computed on the client (999 = unlimited)
    expiresOn: string; // YYYY-MM-DD (Chisinau calendar day)
    label: string | null; // plan name as written in the old system
    startedOn: string | null; // YYYY-MM-DD, kept in the note for context
  },
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const sessions = Math.trunc(input.sessionsRemaining);
  if (!Number.isFinite(sessions) || sessions < 0) return { error: "INVALID_SESSIONS" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn)) return { error: "INVALID_DATE" };
  const audience = input.audience === "child" ? "child" : "adult";

  // Target must be a real client.
  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!target || target.role !== "client") return { error: "USER_NOT_FOUND" };

  // Hang the balance off the hidden per-audience "transferred" system plan.
  const { data: plan } = await supabase
    .from("membership_plans")
    .select("id")
    .eq("system_key", `transfer_${audience}`)
    .maybeSingle();
  if (!plan) return { error: "TRANSFER_PLAN_MISSING" };

  // Valid through the end of the chosen day (mirrors updateMembershipExpiry).
  const expires = bucharestWallToUtc(input.expiresOn, "23:59").toISOString();

  const label = (input.label ?? "").trim();
  const noteParts = ["Transfer"];
  if (label) noteParts.push(label);
  if (input.startedOn && /^\d{4}-\d{2}-\d{2}$/.test(input.startedOn)) {
    noteParts.push(`din ${input.startedOn}`);
  }

  const { error } = await supabase.from("user_memberships").insert({
    user_id: userId,
    plan_id: plan.id as string,
    sessions_remaining: sessions,
    expires_at: expires,
    assigned_by: admin.id,
    note: noteParts.join(" · "),
  });
  if (!error) {
    await logAudit(admin, "membership.transfer", "member", userId, {
      audience,
      sessions,
      expiresOn: input.expiresOn,
    });
  }
  revalidatePath("/[lang]/admin/members", "page");
  return { error: error ? "TRANSFER_FAILED" : null };
}

// Admin confirms (creates the membership) or rejects a pending purchase request.
export async function decideMembershipRequestAction(
  requestId: string,
  approve: boolean,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_membership_request", {
    p_request_id: requestId,
    p_approve: approve,
  });
  if (!error) {
    await logAudit(actor, approve ? "request.approve" : "request.reject", "request", requestId);
  }
  revalidatePath("/[lang]/admin/members", "page");
  // Approving creates a revenue-bearing membership — refresh the dashboard too.
  revalidatePath("/[lang]/admin/dashboard", "page");
  return { error: error?.message ?? null };
}

// --- Membership plan management (prices / offers) --------------------------

export type PlanInput = {
  audience: "adult" | "child";
  name_ro: string;
  name_ru: string;
  session_count: number;
  price: number;
  currency: string;
  validity_days: number;
  featured: boolean;
  active: boolean;
  sort_order: number;
};

export async function upsertPlanAction(
  id: string | null,
  data: PlanInput,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("membership_plans").update(data).eq("id", id)
    : await supabase.from("membership_plans").insert(data);
  revalidatePath("/[lang]/admin/plans", "page");
  revalidatePath("/[lang]/memberships", "page");
  return { error: error?.message ?? null };
}

export async function deletePlanAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  // Plans referenced by sold memberships can't be hard-deleted (FK restrict);
  // fall back to deactivating so history stays intact.
  const { error } = await supabase.from("membership_plans").delete().eq("id", id);
  if (error) {
    const { error: e2 } = await supabase
      .from("membership_plans")
      .update({ active: false })
      .eq("id", id);
    revalidatePath("/[lang]/admin/plans", "page");
    revalidatePath("/[lang]/memberships", "page");
    return { error: e2?.message ?? null };
  }
  revalidatePath("/[lang]/admin/plans", "page");
  revalidatePath("/[lang]/memberships", "page");
  return { error: null };
}

export async function createTemplateAction(input: {
  classTypeId: string;
  weekday: number;
  startTime: string;
  durationMin: number;
  capacity: number;
  instructor: string | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("weekly_templates").insert({
    class_type_id: input.classTypeId,
    weekday: input.weekday,
    start_time: input.startTime,
    duration_min: input.durationMin,
    capacity: input.capacity,
    instructor: input.instructor,
  });
  revalidatePath("/[lang]/admin/templates", "page");
  return { error: error?.message ?? null };
}

export async function toggleTemplateAction(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("weekly_templates")
    .update({ active })
    .eq("id", id);
  revalidatePath("/[lang]/admin/templates", "page");
  return { error: error?.message ?? null };
}

export async function deleteTemplateAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("weekly_templates").delete().eq("id", id);
  revalidatePath("/[lang]/admin/templates", "page");
  return { error: error?.message ?? null };
}

export async function createSessionAction(input: {
  classTypeId: string;
  date: string; // YYYY-MM-DD (Bucharest)
  time: string; // HH:MM (Bucharest)
  durationMin: number;
  capacity: number;
  instructor: string | null;
}): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const startsAt = bucharestWallToUtc(input.date, input.time).toISOString();
  const { error } = await supabase.from("sessions").insert({
    class_type_id: input.classTypeId,
    starts_at: startsAt,
    duration_min: input.durationMin,
    capacity: input.capacity,
    instructor: input.instructor,
  });
  revalidatePath("/[lang]/admin/templates", "page");
  revalidatePath("/[lang]", "page");
  return { error: error?.message ?? null };
}

// Hard-delete a session (and its bookings, via ON DELETE CASCADE). Used by the
// weekly editor to actually remove a class from the schedule — unlike deleting a
// template, this also clears it from the public Program.
export async function deleteSessionAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("sessions").delete().eq("id", id);
  revalidatePath("/[lang]/admin/templates", "page");
  revalidatePath("/[lang]", "page");
  return { error: error?.message ?? null };
}

// Snapshot a concrete week's sessions into the recurring weekly template, so
// future weeks generate the same layout. Replaces the existing template.
export async function saveWeekAsTemplateAction(
  startISO: string,
  endISO: string,
): Promise<ActionResult> {
  await requireAdmin();
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { error: "INVALID" };
  }
  const supabase = await createClient();

  const { data: sessions, error: sErr } = await supabase
    .from("sessions")
    .select("starts_at, duration_min, capacity, instructor, class_type_id")
    .eq("status", "scheduled")
    .gte("starts_at", startISO)
    .lt("starts_at", endISO);
  if (sErr) return { error: sErr.message };

  const rows = (sessions ?? []).map((s: Record<string, unknown>) => ({
    class_type_id: s.class_type_id as string,
    weekday: weekdayInTz(s.starts_at as string),
    start_time: wallTimeInTz(s.starts_at as string),
    duration_min: s.duration_min as number,
    capacity: s.capacity as number,
    instructor: (s.instructor as string) ?? null,
    active: true,
  }));

  // Replace the whole recurring template with this week's layout.
  const { error: delErr } = await supabase
    .from("weekly_templates")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");
  if (delErr) return { error: delErr.message };

  if (rows.length > 0) {
    const { error: insErr } = await supabase.from("weekly_templates").insert(rows);
    if (insErr) return { error: insErr.message };
  }
  revalidatePath("/[lang]/admin/templates", "page");
  return { error: null };
}

export async function cancelSessionAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ status: "cancelled" })
    .eq("id", id);
  if (error) {
    revalidatePath("/[lang]/admin", "page");
    return { error: error.message };
  }
  // Cascade: cancel the active bookings on this session so booked customers
  // aren't left holding a phantom reservation for a class that won't happen.
  await supabase
    .from("bookings")
    .update({ status: "cancelled" })
    .eq("session_id", id)
    .in("status", ["booked", "pending"]);
  revalidatePath("/[lang]/admin", "page");
  return { error: null };
}

// Materialize sessions from active templates for the next N weeks (manual run;
// also runnable on a schedule — see Phase 7).
export async function generateSessionsAction(weeks: number): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_sessions", { p_weeks: weeks });
  revalidatePath("/[lang]/admin/templates", "page");
  revalidatePath("/[lang]", "page");
  return { error: error?.message ?? null };
}

// --- Members explorer (read-only deep dive) --------------------------------
// These use the service-role client (after requireAdmin) so a single round-trip
// can read across every table for one member, regardless of per-table RLS.

export interface AdminMemberRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

export async function searchMembersAction(query: string): Promise<AdminMemberRow[]> {
  await requireStaff();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return [];
  }
  let req = admin
    .from("profiles")
    .select("id, email, full_name, phone, created_at")
    .eq("role", "client");
  // Strip PostgREST filter metacharacters so a name with commas/parens/% can't
  // break (or widen) the .or() filter expression.
  const q = query.replace(/[%,()*\\]/g, " ").trim();
  if (q) req = req.or(`email.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`);
  const { data } = await req.order("created_at", { ascending: false }).limit(50);
  return (data ?? []) as AdminMemberRow[];
}

type DetailPlan = {
  name_ro: string;
  name_ru: string;
  session_count: number;
  price: number;
  currency: string;
};
type DetailClassType = {
  name_ro: string;
  name_ru: string;
  color: string;
  audience: string;
};

export interface AdminMemberDetail {
  profile: {
    id: string;
    email: string;
    full_name: string | null;
    phone: string | null;
    preferred_lang: string;
    role: string;
    notes: string | null;
    created_at: string;
  };
  stats: {
    totalSpent: number;
    currency: string;
    sessionsAttended: number;
    activeMemberships: number;
    upcoming: number;
  };
  memberships: {
    id: string;
    sessions_remaining: number;
    expires_at: string;
    created_at: string;
    note: string | null;
    frozen: boolean;
    plan: DetailPlan | null;
  }[];
  requests: {
    id: string;
    status: string;
    created_at: string;
    plan: { name_ro: string; name_ru: string } | null;
  }[];
  bookings: {
    id: string;
    status: string;
    created_at: string;
    child_name: string | null;
    session: { starts_at: string; class_type: DetailClassType | null } | null;
  }[];
  children: { id: string; name: string; birth_year: number | null }[];
}

export async function getMemberDetailAction(
  userId: string,
): Promise<AdminMemberDetail | null> {
  await requireAdmin();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return null;
  }

  const [profileR, memsR, reqsR, bookingsR, childrenR] = await Promise.all([
    admin
      .from("profiles")
      .select("id, email, full_name, phone, preferred_lang, role, notes, created_at")
      .eq("id", userId)
      .single(),
    admin
      .from("user_memberships")
      .select(
        "id, sessions_remaining, expires_at, created_at, note, frozen, plan:membership_plans ( name_ro, name_ru, session_count, price, currency )",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("membership_requests")
      .select("id, status, created_at, plan:membership_plans ( name_ro, name_ru )")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("bookings")
      .select(
        "id, status, created_at, child:children ( name ), session:sessions ( starts_at, class_type:class_types ( name_ro, name_ru, color, audience ) )",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    admin
      .from("children")
      .select("id, name, birth_year")
      .eq("parent_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  if (!profileR.data) return null;
  const p = profileR.data as Record<string, unknown>;

  const memberships = (memsR.data ?? []).map((m: Record<string, unknown>) => ({
    id: m.id as string,
    sessions_remaining: m.sessions_remaining as number,
    expires_at: m.expires_at as string,
    created_at: m.created_at as string,
    note: (m.note as string) ?? null,
    frozen: !!m.frozen,
    plan: pickOne(m.plan as never) as DetailPlan | null,
  }));

  const requests = (reqsR.data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    status: r.status as string,
    created_at: r.created_at as string,
    plan: pickOne(r.plan as never) as { name_ro: string; name_ru: string } | null,
  }));

  const bookings = (bookingsR.data ?? []).map((b: Record<string, unknown>) => {
    const sRaw = pickOne(b.session as never) as Record<string, unknown> | null;
    const child = pickOne(b.child as never) as { name: string } | null;
    return {
      id: b.id as string,
      status: b.status as string,
      created_at: b.created_at as string,
      child_name: child?.name ?? null,
      session: sRaw
        ? {
            starts_at: sRaw.starts_at as string,
            class_type: pickOne(sRaw.class_type as never) as DetailClassType | null,
          }
        : null,
    };
  });

  // Most recent session first (fall back to booking time for orphaned rows).
  bookings.sort((a, b) => {
    const ta = a.session ? new Date(a.session.starts_at).getTime() : new Date(a.created_at).getTime();
    const tb = b.session ? new Date(b.session.starts_at).getTime() : new Date(b.created_at).getTime();
    return tb - ta;
  });

  const now = Date.now();
  let totalSpent = 0;
  let currency = "MDL";
  for (const m of memberships) {
    if (m.plan) {
      totalSpent += Number(m.plan.price) || 0;
      if (m.plan.currency) currency = m.plan.currency;
    }
  }

  return {
    profile: {
      id: p.id as string,
      email: p.email as string,
      full_name: (p.full_name as string) ?? null,
      phone: (p.phone as string) ?? null,
      preferred_lang: (p.preferred_lang as string) ?? "ro",
      role: (p.role as string) ?? "client",
      notes: (p.notes as string) ?? null,
      created_at: p.created_at as string,
    },
    stats: {
      totalSpent,
      currency,
      sessionsAttended: bookings.filter((b) => b.status === "attended").length,
      activeMemberships: memberships.filter(
        (m) => new Date(m.expires_at).getTime() > now && m.sessions_remaining > 0 && !m.frozen,
      ).length,
      upcoming: bookings.filter(
        (b) =>
          b.session &&
          new Date(b.session.starts_at).getTime() > now &&
          (b.status === "booked" || b.status === "pending"),
      ).length,
    },
    memberships,
    requests,
    bookings,
    children: (childrenR.data ?? []) as AdminMemberDetail["children"],
  };
}

// --- Membership management (admin) -----------------------------------------

export async function setMembershipFrozenAction(
  membershipId: string,
  frozen: boolean,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const supabase = await createClient();

  if (frozen) {
    // Start the freeze: stamp when it began so unfreeze can pay the days back.
    const { error } = await supabase
      .from("user_memberships")
      .update({ frozen: true, freeze_start_date: new Date().toISOString() })
      .eq("id", membershipId);
    if (!error) await logAudit(actor, "membership.freeze", "membership", membershipId);
    revalidatePath("/[lang]/admin/members", "page");
    return { error: error?.message ?? null };
  }

  // Unfreeze: push expiry out by however many days it was paused, so the member
  // gets back the time they lost while frozen.
  const { data: m } = await supabase
    .from("user_memberships")
    .select("expires_at, freeze_start_date")
    .eq("id", membershipId)
    .maybeSingle();
  if (!m) return { error: "NOT_FOUND" };

  let newExpiry = m.expires_at as string;
  if (m.freeze_start_date) {
    const frozenMs = Date.now() - new Date(m.freeze_start_date as string).getTime();
    // Round to the nearest whole day: a ~5-day freeze returns exactly 5 days.
    const frozenDays = Math.max(0, Math.round(frozenMs / 86400000));
    if (frozenDays > 0) {
      newExpiry = new Date(
        new Date(m.expires_at as string).getTime() + frozenDays * 86400000,
      ).toISOString();
    }
  }
  const { error } = await supabase
    .from("user_memberships")
    .update({ frozen: false, freeze_start_date: null, expires_at: newExpiry })
    .eq("id", membershipId);
  if (!error) await logAudit(actor, "membership.unfreeze", "membership", membershipId);
  revalidatePath("/[lang]/admin/members", "page");
  return { error: error?.message ?? null };
}

// Promote a member to reception (front-desk staff) or demote back to client.
// Admin-only, and it refuses to touch admin accounts. The guard_profile_role
// trigger permits this because the service role has no auth.uid().
export async function setStaffRoleAction(
  userId: string,
  makeReception: boolean,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  let service;
  try {
    service = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }
  const { data: target } = await service
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (!target) return { error: "USER_NOT_FOUND" };
  if (target.role === "admin") return { error: "CANNOT_MODIFY_ADMIN" };

  const newRole = makeReception ? "reception" : "client";
  const { error } = await service
    .from("profiles")
    .update({ role: newRole })
    .eq("id", userId);
  if (!error) await logAudit(actor, "member.role", "member", userId, { role: newRole });
  revalidatePath("/[lang]/admin/members", "page");
  return { error: error?.message ?? null };
}

// Save free-text staff notes on a member (injuries, preferences, etc.).
export async function updateMemberNotesAction(
  userId: string,
  notes: string,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const supabase = await createClient();
  const trimmed = notes.trim();
  const { error } = await supabase
    .from("profiles")
    .update({ notes: trimmed || null })
    .eq("id", userId);
  if (!error) await logAudit(actor, "member.notes", "member", userId);
  revalidatePath("/[lang]/admin/members", "page");
  return { error: error?.message ?? null };
}

export async function addMembershipSessionsAction(
  membershipId: string,
  count: number,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!Number.isFinite(count) || count === 0) return { error: "INVALID" };
  const supabase = await createClient();
  const { data: m } = await supabase
    .from("user_memberships")
    .select("sessions_remaining")
    .eq("id", membershipId)
    .maybeSingle();
  if (!m) return { error: "NOT_FOUND" };
  const next = Math.max(0, (m.sessions_remaining as number) + Math.trunc(count));
  const { error } = await supabase
    .from("user_memberships")
    .update({ sessions_remaining: next })
    .eq("id", membershipId);
  if (!error) {
    await logAudit(actor, "membership.sessions", "membership", membershipId, {
      delta: Math.trunc(count),
      to: next,
    });
  }
  revalidatePath("/[lang]/admin/members", "page");
  return { error: error?.message ?? null };
}

export async function updateMembershipExpiryAction(
  membershipId: string,
  dateStr: string, // YYYY-MM-DD (Chisinau calendar day)
): Promise<ActionResult> {
  const actor = await requireAdmin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return { error: "INVALID_DATE" };
  const supabase = await createClient();
  // Valid through the end of the chosen day.
  const expires = bucharestWallToUtc(dateStr, "23:59").toISOString();
  const { error } = await supabase
    .from("user_memberships")
    .update({ expires_at: expires })
    .eq("id", membershipId);
  if (!error) {
    await logAudit(actor, "membership.expiry", "membership", membershipId, { to: dateStr });
  }
  revalidatePath("/[lang]/admin/members", "page");
  return { error: error?.message ?? null };
}

export async function deleteMembershipAction(
  membershipId: string,
): Promise<ActionResult> {
  const actor = await requireAdmin();
  const supabase = await createClient();
  // bookings.membership_id is ON DELETE SET NULL, so past attendance survives.
  const { error } = await supabase
    .from("user_memberships")
    .delete()
    .eq("id", membershipId);
  if (!error) await logAudit(actor, "membership.delete", "membership", membershipId);
  revalidatePath("/[lang]/admin/members", "page");
  return { error: error?.message ?? null };
}

// --- Per-page resets (admin only, IRREVERSIBLE) ----------------------------
// Each reset wipes one admin page's data and nothing else. They use the
// service-role client (after requireAdmin) so cross-table cascades and
// auth-user deletion work regardless of RLS. Admin accounts are ALWAYS kept.

// A reset reports how many rows it actually removed, so a no-op (0) is visible
// in the UI instead of a misleading "success".
type ResetResult = { error: string | null; deleted?: number };

// PostgREST refuses an unfiltered delete, so each delete carries a filter that
// still matches every row: `created_at >= epoch`. (Using a uuid `neq` sentinel
// is fragile — `.select()` after delete returns the removed rows for counting.)
const EPOCH = "1970-01-01T00:00:00Z";

// Statistici (dashboard): the "reset everything" button. Every dashboard metric
// is derived from client accounts, their memberships/requests/bookings, and the
// schedule — so this wipes all of them and every number drops to zero. Admin
// accounts, class types and the price catalog (membership_plans) are kept.
export async function resetStatisticsAction(): Promise<ResetResult> {
  const actor = await requireAdmin();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }

  // 1. Every client account — profiles, children, user_memberships,
  //    membership_requests and bookings all cascade from auth.users / profiles.
  const { data: clients, error: qErr } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client");
  if (qErr) return { error: qErr.message };
  let removed = 0;
  for (const c of clients ?? []) {
    const { error } = await admin.auth.admin.deleteUser(c.id as string);
    if (error && !/not.?found/i.test(error.message)) return { error: error.message };
    if (!error) removed += 1;
  }

  // 2. The schedule itself (sessions + recurring templates).
  const { data: sess, error: sErr } = await admin
    .from("sessions")
    .delete()
    .gte("created_at", EPOCH)
    .select("id");
  if (sErr) return { error: sErr.message };
  const { data: tmpl, error: tErr } = await admin
    .from("weekly_templates")
    .delete()
    .gte("created_at", EPOCH)
    .select("id");
  if (tErr) return { error: tErr.message };

  const deleted = removed + (sess?.length ?? 0) + (tmpl?.length ?? 0);
  await logAudit(actor, "reset.statistics", "reset", null, { deleted });
  revalidatePath("/[lang]/admin/dashboard", "page");
  revalidatePath("/[lang]/admin/members", "page");
  revalidatePath("/[lang]/admin/templates", "page");
  revalidatePath("/[lang]", "page");
  return { error: null, deleted };
}

// Program săptămânal: clear the whole schedule — every session (its bookings
// cascade-delete) and every recurring weekly template. Class types (the
// catalog) stay so the schedule can be rebuilt.
export async function resetScheduleAction(): Promise<ResetResult> {
  const actor = await requireAdmin();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }
  const { data: s, error: sErr } = await admin
    .from("sessions")
    .delete()
    .gte("created_at", EPOCH)
    .select("id");
  if (sErr) return { error: sErr.message };
  const { data: t, error: tErr } = await admin
    .from("weekly_templates")
    .delete()
    .gte("created_at", EPOCH)
    .select("id");
  if (tErr) return { error: tErr.message };
  const deleted = (s?.length ?? 0) + (t?.length ?? 0);
  await logAudit(actor, "reset.schedule", "reset", null, { deleted });
  revalidatePath("/[lang]/admin/templates", "page");
  revalidatePath("/[lang]", "page");
  return { error: null, deleted };
}

// Membri: delete every client account. profiles, children, user_memberships,
// membership_requests and bookings all cascade from auth.users / profiles, so
// deleting the auth user removes the member's entire footprint. role='admin'
// accounts are preserved.
export async function resetMembersAction(): Promise<ResetResult> {
  const actor = await requireAdmin();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }
  const { data: clients, error: qErr } = await admin
    .from("profiles")
    .select("id")
    .eq("role", "client");
  if (qErr) return { error: qErr.message };
  let removed = 0;
  for (const c of clients ?? []) {
    const { error } = await admin.auth.admin.deleteUser(c.id as string);
    // Tolerate an already-gone user so a partially-cleaned state can finish.
    if (error && !/not.?found/i.test(error.message)) return { error: error.message };
    if (!error) removed += 1;
  }
  await logAudit(actor, "reset.members", "reset", null, { deleted: removed });
  revalidatePath("/[lang]/admin/members", "page");
  revalidatePath("/[lang]/admin/dashboard", "page");
  return { error: null, deleted: removed };
}

// Prețuri: delete the entire plan catalog. user_memberships.plan_id and
// membership_requests.plan_id are ON DELETE RESTRICT, so those dependents are
// removed first — this also clears members' active memberships.
export async function resetPlansAction(): Promise<ResetResult> {
  const actor = await requireAdmin();
  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }
  const { error: rErr } = await admin
    .from("membership_requests")
    .delete()
    .gte("created_at", EPOCH);
  if (rErr) return { error: rErr.message };
  const { error: mErr } = await admin
    .from("user_memberships")
    .delete()
    .gte("created_at", EPOCH);
  if (mErr) return { error: mErr.message };
  // Keep the hidden per-audience "transferred" system plans — deleting them
  // would permanently break legacy transfer + auto-claim (they're seeded only
  // in migration 0012 and never re-created).
  const { data: p, error: pErr } = await admin
    .from("membership_plans")
    .delete()
    .is("system_key", null)
    .select("id");
  if (pErr) return { error: pErr.message };
  await logAudit(actor, "reset.plans", "reset", null, { deleted: p?.length ?? 0 });
  revalidatePath("/[lang]/admin/plans", "page");
  revalidatePath("/[lang]/memberships", "page");
  revalidatePath("/[lang]/admin/members", "page");
  return { error: null, deleted: p?.length ?? 0 };
}
