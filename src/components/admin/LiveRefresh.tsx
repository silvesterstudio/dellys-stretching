"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Keeps admin/staff views live without a manual refresh: subscribes to the
// relevant tables and re-runs the server component tree (router.refresh) on any
// change. Debounced so a burst of DB writes triggers a single refetch. Mounted
// once in the admin layout so every admin page updates in real time.
const DEFAULT_TABLES = [
  "bookings",
  "user_memberships",
  "guest_bookings",
  "sessions",
  "membership_requests",
  "profiles",
] as const;

export function LiveRefresh({ tables = DEFAULT_TABLES }: { tables?: readonly string[] }) {
  const router = useRouter();

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 350);
    };

    const channel = supabase.channel("admin-live");
    for (const table of tables) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
    }
    channel.subscribe();

    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
    };
    // `tables` is a stable module constant by default; joined to satisfy deps.
  }, [router, tables]);

  return null;
}
