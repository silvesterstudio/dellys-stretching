import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { KioskScanResult } from "@/lib/types";

// The kiosk is a fixed tablet at a studio entrance. It POSTs the scanned QR
// together with its own device token; the token is what decides WHICH gym the
// check-in lands at, so a tablet can never check someone into the other studio.
//
// All the business logic lives in the kiosk_scan() RPC (migration 0024) so the
// tablet and the front desk can never drift apart. This route only:
//   1. rate-limits,
//   2. resolves device token -> location,
//   3. calls the RPC with the service role.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Per-IP throttle. In-memory: resets on cold start, which is fine — this exists
// to blunt a QR-guessing loop, not to be a distributed quota.
const hits = new Map<string, { n: number; resetAt: number }>();
const LIMIT = 15;
const WINDOW_MS = 10_000;

function rateLimited(key: string): boolean {
  const now = Date.now();
  const entry = hits.get(key);
  if (!entry || now > entry.resetAt) {
    hits.set(key, { n: 1, resetAt: now + WINDOW_MS });
    // Opportunistic sweep so the map can't grow without bound.
    if (hits.size > 500) {
      for (const [k, v] of hits) if (now > v.resetAt) hits.delete(k);
    }
    return false;
  }
  entry.n += 1;
  return entry.n > LIMIT;
}

type Body = { qr_uuid?: unknown; device_token?: unknown };

function fail(code: string, status: number) {
  return NextResponse.json({ ok: false, code }, { status });
}

export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return fail("rate_limited", 429);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return fail("bad_request", 400);
  }

  const qr = typeof body.qr_uuid === "string" ? body.qr_uuid.trim() : "";
  const deviceToken =
    typeof body.device_token === "string" ? body.device_token.trim() : "";
  if (!qr || !deviceToken) return fail("bad_request", 400);

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return fail("server_error", 500);
  }

  // One call does the lot: resolve the tablet, stamp its heartbeat, decide.
  // It used to be three sequential round trips to the database per scan, with a
  // person standing at the door for each one.
  //
  // An unknown or deactivated tablet is settled inside, before the member is so
  // much as looked up — that token is the only thing between a leaked kiosk URL
  // and free check-ins.
  const { data, error } = await admin.rpc("kiosk_scan_by_token", {
    p_qr: qr,
    p_device_token: deviceToken,
  });
  if (error) {
    console.error("kiosk_scan_by_token:", error.message);
    return fail("server_error", 500);
  }

  const result = data as unknown as KioskScanResult;
  return NextResponse.json(result, { status: result.ok ? 200 : 403 });
}

export async function GET() {
  return fail("method_not_allowed", 405);
}
