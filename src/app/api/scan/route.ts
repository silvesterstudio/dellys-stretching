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

type Body = {
  qr_uuid?: unknown;
  device_token?: unknown;
  // Present on the second call: what the member tapped. `picks` carries a
  // selection of one or more; session_id/child_id is the single-pick form.
  session_id?: unknown;
  child_id?: unknown;
  picks?: unknown;
};

// A parent checking in two children, or somebody taking two classes back to
// back, is one queue at one door — not two trips through it. Capped because
// every entry spends a session, and a stuck finger should not empty a bundle.
const MAX_PICKS = 8;

type Pick = { session_id: string; child_id: string | null };

function readPicks(body: Body): Pick[] {
  const one = typeof body.session_id === "string" ? body.session_id.trim() : "";
  if (one) {
    return [{ session_id: one, child_id: typeof body.child_id === "string" && body.child_id ? body.child_id : null }];
  }
  if (!Array.isArray(body.picks)) return [];
  const out: Pick[] = [];
  for (const raw of body.picks.slice(0, MAX_PICKS)) {
    const p = raw as { session_id?: unknown; child_id?: unknown };
    const sid = typeof p?.session_id === "string" ? p.session_id.trim() : "";
    if (!sid) continue;
    const cid = typeof p?.child_id === "string" && p.child_id ? p.child_id : null;
    // The same seat twice in one tap is a double-tap, not two people.
    if (out.some((x) => x.session_id === sid && x.child_id === cid)) continue;
    out.push({ session_id: sid, child_id: cid });
  }
  return out;
}

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

  // Two shapes, one endpoint. Without a session_id this asks WHAT the member
  // could check into and writes nothing; with one it does that specific thing.
  // Splitting it this way is what lets the tablet show the classes and let the
  // member choose, rather than the door guessing and being wrong in silence.
  //
  // Either way the tablet is resolved inside the RPC — that device token is the
  // only thing between a leaked kiosk URL and free check-ins, and it is settled
  // before the member is so much as looked up.
  const picks = readPicks(body);

  // Nothing picked: this is the question, not the answer.
  if (picks.length === 0) {
    const { data, error } = await admin.rpc("kiosk_options", {
      p_qr: qr,
      p_device_token: deviceToken,
    });
    if (error) {
      console.error("kiosk_options:", error.message);
      return fail("server_error", 500);
    }
    const result = data as unknown as KioskScanResult;

    // A list of choices is NOT a check-in, and must never be mistaken for one.
    //
    // This bit the real tablet: it was still running the previous bundle, whose
    // only test was `data.ok`. kiosk_options answers ok:true — so the stale
    // kiosk read "here is what you could do" as "done", and showed a member
    // "Bine ai venit" with their name while nothing whatsoever had been
    // written. A door that lies in the safe direction is bad; one that lies in
    // the permissive direction is how people walk in unpaid.
    //
    // Sending ok:false makes any client that predates the picker fall into its
    // error branch instead — an out-of-date tablet says something went wrong,
    // which is true, rather than waving somebody through. The current kiosk
    // keys off `code`, not `ok`.
    if (result.code === "options") {
      return NextResponse.json({ ...result, ok: false }, { status: 200 });
    }
    return NextResponse.json(result, { status: result.ok ? 200 : 403 });
  }

  // One or more seats. Each is its own atomic decision — the RPC re-checks
  // capacity, membership and ownership every time — so a seat lost between the
  // list and the tap refuses that one entry without spoiling the others.
  // Sequential, not parallel: two entries can draw on the same bundle, and the
  // row lock that keeps that honest would otherwise have them queue anyway.
  const admitted: KioskScanResult[] = [];
  const refused: KioskScanResult[] = [];
  for (const pick of picks) {
    const { data, error } = await admin.rpc("kiosk_check_in_choice", {
      p_qr: qr,
      p_device_token: deviceToken,
      p_session: pick.session_id,
      p_child: pick.child_id,
    });
    if (error) {
      console.error("kiosk_check_in_choice:", error.message);
      return fail("server_error", 500);
    }
    const one = data as unknown as KioskScanResult;
    (one.ok ? admitted : refused).push(one);
  }

  // A single pick keeps the shape it always had, so nothing downstream has to
  // special-case the ordinary case.
  if (picks.length === 1) {
    const only = admitted[0] ?? refused[0];
    return NextResponse.json(only, { status: only.ok ? 200 : 403 });
  }

  const head = admitted[0] ?? refused[0];
  return NextResponse.json(
    { ...head, ok: admitted.length > 0, code: admitted.length > 0 ? "ok" : head.code, admitted, refused },
    { status: admitted.length > 0 ? 200 : 403 },
  );
}

export async function GET() {
  return fail("method_not_allowed", 405);
}
