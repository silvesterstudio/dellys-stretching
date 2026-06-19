"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { bucharestWallToUtc } from "@/lib/week";

// All actions re-verify admin server-side (defense in depth) and rely on RLS
// (is_admin()) for the actual writes. They return a string error code or null.

type ActionResult = { error: string | null };

export async function checkInAction(
  bookingId: string,
  membershipId: string | null,
): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("check_in_booking", {
    p_booking_id: bookingId,
    p_membership_id: membershipId,
  });
  revalidatePath("/[lang]/admin/sessions/[id]", "page");
  return { error: error?.message ?? null };
}

export async function markNoShowAction(bookingId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status: "no_show" })
    .eq("id", bookingId);
  revalidatePath("/[lang]/admin/sessions/[id]", "page");
  return { error: error?.message ?? null };
}

export async function assignMembershipAction(
  userId: string,
  planId: string,
  note: string | null,
): Promise<ActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { data: plan, error: planErr } = await supabase
    .from("membership_plans")
    .select("session_count, validity_days")
    .eq("id", planId)
    .single();
  if (planErr || !plan) return { error: "PLAN_NOT_FOUND" };

  const expires = new Date(
    Date.now() + plan.validity_days * 86400000,
  ).toISOString();

  const { error } = await supabase.from("user_memberships").insert({
    user_id: userId,
    plan_id: planId,
    sessions_remaining: plan.session_count,
    expires_at: expires,
    assigned_by: admin.id,
    note,
  });
  revalidatePath("/[lang]/admin/members", "page");
  return { error: error?.message ?? null };
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
  revalidatePath("/[lang]/admin", "page");
  return { error: error?.message ?? null };
}

export async function cancelSessionAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("sessions")
    .update({ status: "cancelled" })
    .eq("id", id);
  revalidatePath("/[lang]/admin", "page");
  return { error: error?.message ?? null };
}

// Materialize sessions from active templates for the next N weeks (manual run;
// also runnable on a schedule — see Phase 7).
export async function generateSessionsAction(weeks: number): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("generate_sessions", { p_weeks: weeks });
  revalidatePath("/[lang]/admin", "page");
  return { error: error?.message ?? null };
}
