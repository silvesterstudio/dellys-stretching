"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { MIN_PASSWORD } from "@/lib/constants";

// Public self-service sign-up. There is no session yet, so this deliberately
// has no auth gate — everything it can do is "create one ordinary client
// account", and profiles.role defaults to 'client' (0001), so no caller can
// mint staff. It runs server-side only, so the service key never ships to the
// browser.
//
// The account is created through the admin API with email_confirm:true rather
// than supabase.auth.signUp() on purpose: the project is on the free tier with
// Supabase's built-in mailer (a couple of messages an hour, poor
// deliverability), so anything that depends on the member receiving a
// confirmation mail would strand most sign-ups. This way the account is usable
// the instant the form is submitted, and the browser signs in with the password
// it just chose.

type ActionResult = { error: string | null };

export interface SignUpInput {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  locationKey: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signUpAction(input: SignUpInput): Promise<ActionResult> {
  const fullName = (input.fullName ?? "").trim().replace(/\s+/g, " ");
  const phoneRaw = (input.phone ?? "").trim();
  const email = (input.email ?? "").trim().toLowerCase();
  const password = input.password ?? "";

  if (fullName.length < 2 || fullName.length > 80) return { error: "INVALID_NAME" };
  // Moldovan numbers land between 8 and 15 digits once punctuation is stripped.
  const digits = phoneRaw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return { error: "INVALID_PHONE" };
  if (!EMAIL_RE.test(email) || email.length > 160) return { error: "INVALID_EMAIL" };
  if (password.length < MIN_PASSWORD || password.length > 72) return { error: "WEAK_PASSWORD" };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { error: "NO_SERVICE_KEY" };

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }

  // Resolve the chosen studio up front — a member with no location_id drops out
  // of both studios' rosters, which is exactly how a paying member once went
  // missing. Fall back to the first studio rather than leaving it null.
  let locationId: string | null = null;
  const { data: locations } = await admin.from("locations").select("id, key").order("key");
  if (locations?.length) {
    locationId =
      (locations.find((l) => l.key === input.locationKey)?.id as string | undefined) ??
      (locations[0].id as string);
  }

  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, phone: phoneRaw, preferred_lang: "ro" },
    }),
  });

  if (!res.ok) {
    const body = (await res.text()).toLowerCase();
    if (res.status === 422 || body.includes("already") || body.includes("registered")) {
      return { error: "EMAIL_TAKEN" };
    }
    if (body.includes("password")) return { error: "WEAK_PASSWORD" };
    return { error: "SIGNUP_FAILED" };
  }

  const user = (await res.json()) as { id?: string };
  if (!user.id) return { error: "SIGNUP_FAILED" };

  // The on_auth_user_created trigger has already inserted the profile row with
  // just id/email/preferred_lang; fill in what the form collected.
  const { error: profErr } = await admin
    .from("profiles")
    .update({ full_name: fullName, phone: phoneRaw, location_id: locationId })
    .eq("id", user.id);
  if (profErr) {
    // The account exists and is usable, so don't fail the sign-up over this —
    // but leave a trace, since a nameless member is hard to find at the desk.
    console.error("signUp: profile update failed", profErr.message, { userId: user.id });
  }

  return { error: null };
}
