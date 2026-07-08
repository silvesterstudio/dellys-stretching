"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { bucharestWallToUtc } from "@/lib/week";
import type { ClassAudience } from "@/lib/constants";

// ── Parsing pasted spreadsheet rows ────────────────────────────────────────
// Expected column order (paste straight from Excel = tab-separated; comma /
// semicolon also accepted):
//   1 Nume  2 Telefon  3 Ședințe rămase  4 Expiră  5 Public(adult/copil)
//   6 Email  7 Etichetă plan  8 Notă
// Only the first four are required; a phone OR an email must be present so the
// row can be matched to an account.

export interface ImportResult {
  inserted: number;
  skipped: number; // duplicates of an existing pending row
  linked: number; // auto-linked to an already-registered account
  errors: string[]; // human-readable, per problem row
}

function splitCells(line: string): string[] {
  const delim = line.includes("\t") ? "\t" : line.includes(";") ? ";" : ",";
  return line.split(delim).map((c) => c.trim());
}

// Mirror of the SQL normalize_phone: last 8 digits, or null if too short.
function phoneDigits(raw: string): string | null {
  const d = raw.replace(/\D/g, "");
  if (d.length < 8) return null;
  return d.slice(-8);
}

function parseDate(s: string): string | null {
  const t = s.trim();
  let y: number, m: number, d: number;
  let mt: RegExpExecArray | null;
  if ((mt = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t))) {
    y = +mt[1]; m = +mt[2]; d = +mt[3];
  } else if ((mt = /^(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})$/.exec(t))) {
    d = +mt[1]; m = +mt[2]; y = +mt[3];
  } else {
    return null;
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseAudience(s: string, dflt: ClassAudience): ClassAudience {
  const v = s.trim().toLowerCase();
  if (["copil", "copii", "child", "children", "kid", "kids", "c"].includes(v)) return "child";
  if (["adult", "adulti", "adulți", "adults", "a"].includes(v)) return "adult";
  return dflt;
}

function looksLikeHeader(cells: string[]): boolean {
  // A header has no phone digits and a non-numeric "sessions" cell.
  const phone = cells[1] ?? "";
  const sessions = cells[2] ?? "";
  return !/\d/.test(phone) && !/^\d+$/.test(sessions.trim());
}

export async function importLegacyMembershipsAction(
  raw: string,
  defaultAudience: ClassAudience = "adult",
): Promise<ImportResult> {
  const admin = await requireAdmin();
  const result: ImportResult = { inserted: 0, skipped: 0, linked: 0, errors: [] };

  const lines = (raw ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    result.errors.push("EMPTY");
    return result;
  }

  let service;
  try {
    service = createAdminClient();
  } catch {
    result.errors.push("NO_SERVICE_KEY");
    return result;
  }

  // Existing pending rows -> dedupe key so a re-paste doesn't double-insert.
  const { data: existing } = await service
    .from("legacy_memberships")
    .select("phone_norm, email, sessions_remaining, expires_at, plan_label")
    .eq("status", "pending");
  const seen = new Set<string>(
    (existing ?? []).map((e) =>
      [
        e.phone_norm ?? "",
        (e.email ?? "").toLowerCase(),
        e.sessions_remaining,
        e.expires_at,
        e.plan_label ?? "",
      ].join("|"),
    ),
  );

  type Row = {
    full_name: string | null;
    phone: string | null;
    email: string | null;
    audience: ClassAudience;
    plan_label: string | null;
    sessions_remaining: number;
    expires_at: string;
    note: string | null;
    imported_by: string;
  };
  const rows: Row[] = [];

  lines.forEach((line, idx) => {
    const cells = splitCells(line);
    if (idx === 0 && looksLikeHeader(cells)) return; // skip a header row

    const rowNo = idx + 1;
    const name = (cells[0] ?? "").trim() || null;
    const phoneRaw = (cells[1] ?? "").trim();
    const sessionsRaw = (cells[2] ?? "").trim();
    const dateRaw = (cells[3] ?? "").trim();
    const email = (cells[5] ?? "").trim().toLowerCase() || null;

    const digits = phoneRaw ? phoneDigits(phoneRaw) : null;
    if (!digits && !email) {
      result.errors.push(`Rând ${rowNo}: lipsește telefonul și email-ul`);
      return;
    }
    const sessions = Number.parseInt(sessionsRaw, 10);
    if (!Number.isFinite(sessions) || sessions < 0) {
      result.errors.push(`Rând ${rowNo}: ședințe invalide ("${sessionsRaw}")`);
      return;
    }
    const iso = parseDate(dateRaw);
    if (!iso) {
      result.errors.push(`Rând ${rowNo}: dată invalidă ("${dateRaw}")`);
      return;
    }

    const audience = parseAudience(cells[4] ?? "", defaultAudience);
    const planLabel = (cells[6] ?? "").trim() || null;
    const note = (cells[7] ?? "").trim() || null;
    const expiresAt = bucharestWallToUtc(iso, "23:59").toISOString();

    const dedupeKey = [
      digits ?? "",
      email ?? "",
      sessions,
      expiresAt,
      planLabel ?? "",
    ].join("|");
    if (seen.has(dedupeKey)) {
      result.skipped += 1;
      return;
    }
    seen.add(dedupeKey);

    rows.push({
      full_name: name,
      phone: phoneRaw || null,
      email,
      audience,
      plan_label: planLabel,
      sessions_remaining: sessions,
      expires_at: expiresAt,
      note,
      imported_by: admin.id,
    });
  });

  if (rows.length > 0) {
    const { error } = await service.from("legacy_memberships").insert(rows);
    if (error) {
      result.errors.push("INSERT_FAILED");
      return result;
    }
    result.inserted = rows.length;
  }

  // Link rows that already match a registered account (admin-scoped RPC, so it
  // must run through the authenticated client, not the service role).
  try {
    const rls = await createClient();
    const { data: linked } = await rls.rpc("admin_autolink_legacy");
    result.linked = typeof linked === "number" ? linked : 0;
  } catch {
    // Non-fatal: unlinked rows still auto-claim when the client signs in.
  }

  revalidatePath("/[lang]/admin/transfers", "page");
  revalidatePath("/[lang]/admin/members", "page");
  return result;
}

// Admin manually links one pending row to a chosen account.
export async function adminClaimLegacyAction(
  legacyId: string,
  userId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_claim_legacy", {
    p_legacy_id: legacyId,
    p_user_id: userId,
  });
  revalidatePath("/[lang]/admin/transfers", "page");
  revalidatePath("/[lang]/admin/members", "page");
  return { error: error ? "CLAIM_FAILED" : null };
}

// Discard a pending row that was imported by mistake. Claimed rows are kept as
// an audit trail (delete the resulting membership from the member's page).
export async function deleteLegacyAction(
  legacyId: string,
): Promise<{ error: string | null }> {
  await requireAdmin();
  let service;
  try {
    service = createAdminClient();
  } catch {
    return { error: "NO_SERVICE_KEY" };
  }
  const { error } = await service
    .from("legacy_memberships")
    .delete()
    .eq("id", legacyId)
    .eq("status", "pending");
  revalidatePath("/[lang]/admin/transfers", "page");
  return { error: error ? "DELETE_FAILED" : null };
}
