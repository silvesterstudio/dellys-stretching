import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Lets a provisioned tablet show which studio it is bound to, so staff can tell
// at a glance that the right kiosk is running at the right door. Returns only
// the gym's display name — never the token or anything about members.

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let token = "";
  try {
    const body = (await request.json()) as { device_token?: unknown };
    token = typeof body.device_token === "string" ? body.device_token.trim() : "";
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!token) return NextResponse.json({ ok: false }, { status: 400 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const { data } = await admin
    .from("kiosk_devices")
    .select("active, location:locations ( name )")
    .eq("token", token)
    .maybeSingle();

  if (!data || !data.active) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const loc = data.location as unknown as { name: string } | { name: string }[] | null;
  const name = Array.isArray(loc) ? loc[0]?.name : loc?.name;
  return NextResponse.json({ ok: true, locationName: name ?? "" });
}
