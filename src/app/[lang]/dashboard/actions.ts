"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string | null };

// Client updates their own name + phone (RLS: profiles_update on own row).
export async function updateProfileAction(
  fullName: string | null,
  phone: string | null,
): Promise<ActionResult> {
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

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName?.trim() || null,
      phone: phone?.trim() || null,
    })
    .eq("id", userId);
  revalidatePath("/[lang]/dashboard", "page");
  return { error: error?.message ?? null };
}
