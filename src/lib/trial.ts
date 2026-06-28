import "server-only";
import { TRIAL_CATEGORIES, type TrialCategory } from "@/lib/constants";
import type { createClient } from "@/lib/supabase/server";

type SupaServer = Awaited<ReturnType<typeof createClient>>;

// Categories whose one free introductory session the user has already used.
export async function fetchUsedTrialCategories(
  supabase: SupaServer,
  userId: string,
): Promise<Set<string>> {
  const { data } = await supabase
    .from("free_trial_usage")
    .select("category")
    .eq("user_id", userId);
  return new Set((data ?? []).map((r) => r.category as string));
}

// The trial categories the user still has available (one free session each).
export async function fetchAvailableTrials(
  supabase: SupaServer,
  userId: string,
): Promise<TrialCategory[]> {
  const used = await fetchUsedTrialCategories(supabase, userId);
  return TRIAL_CATEGORIES.filter((c) => !used.has(c));
}
