"use server";

import { requireAdmin } from "@/lib/auth";
import { getAdminScope } from "@/lib/locations-server";
import {
  resolveRange,
  computeWindowMetrics,
  computeActivitySeries,
  type RangeSpec,
  type WindowMetrics,
  type ActivitySeries,
} from "@/lib/admin-analytics";

// Recompute the window stats for a chosen preset / custom range. Re-verifies
// admin server-side; the heavy lifting lives in the analytics module.
export async function getMetricsAction(
  spec: RangeSpec,
): Promise<{
  metrics: WindowMetrics;
  series: ActivitySeries;
  startDate: string;
  endDate: string;
}> {
  const me = await requireAdmin();
  // Re-derive the studio server-side rather than trusting anything from the
  // browser, so a pinned manager can't widen their view by editing the request.
  const { activeId } = await getAdminScope(me);
  const { startISO, endISO, startDate, endDate } = resolveRange(spec);
  // Both in one trip: the charts and the tiles describe the same window, so
  // fetching them separately could show a total that disagrees with its own bars.
  const [metrics, series] = await Promise.all([
    computeWindowMetrics(startISO, endISO, activeId),
    computeActivitySeries(startISO, endISO, activeId),
  ]);
  return { metrics, series, startDate, endDate };
}
