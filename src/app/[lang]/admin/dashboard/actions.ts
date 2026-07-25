"use server";

import { requireAdmin } from "@/lib/auth";
import { getAdminScope } from "@/lib/locations-server";
import {
  resolveRange,
  computeWindowMetrics,
  type RangeSpec,
  type WindowMetrics,
} from "@/lib/admin-analytics";

// Recompute the window stats for a chosen preset / custom range. Re-verifies
// admin server-side; the heavy lifting lives in the analytics module.
export async function getMetricsAction(
  spec: RangeSpec,
): Promise<{ metrics: WindowMetrics; startDate: string; endDate: string }> {
  const me = await requireAdmin();
  // Re-derive the studio server-side rather than trusting anything from the
  // browser, so a pinned manager can't widen their view by editing the request.
  const { activeId } = await getAdminScope(me);
  const { startISO, endISO, startDate, endDate } = resolveRange(spec);
  const metrics = await computeWindowMetrics(startISO, endISO, activeId);
  return { metrics, startDate, endDate };
}
