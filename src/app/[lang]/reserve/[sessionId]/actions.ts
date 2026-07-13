"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { Locale } from "@/lib/constants";

export type GuestBookingResult =
  | { ok: true }
  | { ok: false; error: "invalid" | "unavailable" | "server" };

// Public, no-auth "first reservation" funnel. Captures a lead (full name +
// phone + which class) so the studio can message the person to confirm. The
// lead is stored with the service role (bypasses RLS — this is server-only and
// takes no user input beyond the three fields) and forwarded to an external
// messaging automation via a webhook if one is configured.
export async function createGuestBooking(input: {
  sessionId: string;
  fullName: string;
  phone: string;
  childName?: string;
  lang: Locale;
}): Promise<GuestBookingResult> {
  const fullName = input.fullName?.trim() ?? "";
  const phone = input.phone?.trim() ?? "";
  const childName = input.childName?.trim() ?? "";
  const lang: Locale = input.lang === "ru" ? "ru" : "ro";

  // Basic validation: a real name and a phone with at least 6 digits.
  const digits = phone.replace(/\D/g, "");
  if (fullName.length < 2 || digits.length < 6 || !input.sessionId) {
    return { ok: false, error: "invalid" };
  }
  if (!isSupabaseConfigured()) return { ok: false, error: "server" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { ok: false, error: "server" };
  }

  // Snapshot the class so the lead survives later schedule edits, and so we can
  // only capture leads for a class that is still bookable.
  const { data: session } = await admin
    .from("sessions")
    .select(
      `id, starts_at, status,
       class_type:class_types ( name_ro, name_ru, audience, category )`,
    )
    .eq("id", input.sessionId)
    .maybeSingle();

  if (!session) return { ok: false, error: "unavailable" };
  const s = session as unknown as {
    starts_at: string;
    status: string;
    class_type:
      | { name_ro: string; name_ru: string; audience: string; category: string }
      | { name_ro: string; name_ru: string; audience: string; category: string }[]
      | null;
  };
  if (s.status !== "scheduled" || new Date(s.starts_at).getTime() <= Date.now()) {
    return { ok: false, error: "unavailable" };
  }
  const ct = Array.isArray(s.class_type) ? s.class_type[0] : s.class_type;
  const className = ct ? (lang === "ru" ? ct.name_ru : ct.name_ro) : null;

  // Kids classes: full_name is the parent, and we also need the child's name.
  const isChild = ct?.audience === "child";
  if (isChild && childName.length < 2) {
    return { ok: false, error: "invalid" };
  }

  // Idempotency: a repeat submit (double-tap / refresh) for the same class from
  // the same phone must not hold a second seat.
  const { data: existing } = await admin
    .from("guest_bookings")
    .select("id")
    .eq("session_id", input.sessionId)
    .eq("phone", phone)
    .neq("status", "cancelled")
    .maybeSingle();
  if (existing) return { ok: true };

  // Atomically hold a seat: the conditional update only succeeds while a spot is
  // free (and the class is still open), so concurrent guests can't oversell it.
  const { data: held, error: holdErr } = await admin.rpc("hold_guest_seat", {
    p_session_id: input.sessionId,
  });
  if (holdErr) return { ok: false, error: "server" };
  if (held !== true) return { ok: false, error: "unavailable" };

  const { data: inserted, error } = await admin
    .from("guest_bookings")
    .insert({
      session_id: input.sessionId,
      full_name: fullName,
      phone,
      child_name: isChild ? childName : null,
      lang,
      class_name: className,
      category: ct?.category ?? null,
      starts_at: s.starts_at,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // Release the seat we just held so a failed insert doesn't strand it.
    await admin.rpc("release_guest_seat", { p_session_id: input.sessionId });
    return { ok: false, error: "server" };
  }

  // Forward to an external messaging automation (WhatsApp/Make/n8n/Zapier/…).
  // Fire-and-forget: a webhook failure must not fail the reservation — the lead
  // is already stored and visible to staff as a fallback.
  const hook = process.env.GUEST_BOOKING_WEBHOOK_URL;
  if (hook) {
    try {
      await fetch(hook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.GUEST_BOOKING_WEBHOOK_SECRET
            ? { Authorization: `Bearer ${process.env.GUEST_BOOKING_WEBHOOK_SECRET}` }
            : {}),
        },
        body: JSON.stringify({
          id: inserted.id,
          full_name: fullName,
          phone,
          child_name: isChild ? childName : null,
          lang,
          class_name: className,
          starts_at: s.starts_at,
          session_id: input.sessionId,
        }),
      });
    } catch {
      // ignore — lead is persisted; automation can be retried from the admin list.
    }
  }

  return { ok: true };
}
