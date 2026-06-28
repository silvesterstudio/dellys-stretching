"use server";

import { requireAdmin } from "@/lib/auth";
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
  await requireAdmin();
  const { startISO, endISO, startDate, endDate } = resolveRange(spec);
  const metrics = await computeWindowMetrics(startISO, endISO);
  return { metrics, startDate, endDate };
}
