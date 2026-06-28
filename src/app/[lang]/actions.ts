"use server";

import { fetchSessions, type SessionWithType } from "@/lib/queries";

// Re-fetch the visible week's sessions for the public schedule. Called by the
// realtime grid on any sessions change (insert/update/delete) so newly created
// or cancelled classes appear live, not just occupancy updates. Returns [] on
// bad input rather than throwing.
export async function refreshScheduleAction(
  startISO: string,
  endISO: string,
): Promise<SessionWithType[]> {
  const start = new Date(startISO);
  const end = new Date(endISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  return fetchSessions(start, end);
}
