"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

// Client asks to buy a plan. The seat of truth is the RPC (runs as the signed-in
// user via RLS/SECURITY DEFINER). Returns "AUTH_REQUIRED" when signed out.
export async function requestMembershipAction(planId: string): Promise<ActionResult> {
  const supabase = await createClient();
  let userId: string | null = null;
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    userId = null;
  }
  if (!userId) return { error: "AUTH_REQUIRED" };

  const { error } = await supabase.rpc("request_membership", { p_plan_id: planId });
  revalidatePath("/[lang]/memberships", "page");
  revalidatePath("/[lang]/dashboard", "page");
  return { error: error?.message ?? null };
}

// Client withdraws a still-pending request.
export async function cancelMembershipRequestAction(
  requestId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_membership_request", {
    p_request_id: requestId,
  });
  revalidatePath("/[lang]/dashboard", "page");
  revalidatePath("/[lang]/memberships", "page");
  return { error: error?.message ?? null };
}
