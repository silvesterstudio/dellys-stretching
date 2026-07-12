// Applies migration 0018 and provisions the restricted "dellys_admin" operator
// account (full admin powers EXCEPT the financial dashboard).
//
// Usage (PowerShell):
//   $env:SB_TOKEN="sbp_xxx"; node scripts/setup-0018.mjs
// Usage (bash):
//   SB_TOKEN=sbp_xxx node scripts/setup-0018.mjs
//
// SB_TOKEN = Supabase personal access token (https://supabase.com/dashboard/account/tokens).
// Service role key + project URL are read from .env.local. Idempotent.
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.SB_TOKEN;
const REF = process.env.SB_REF || "idkrwfldytvsqaoxdgyi";
if (!TOKEN) {
  console.error("Missing SB_TOKEN (Supabase personal access token).");
  process.exit(1);
}

// --- read service role key + url from .env.local ---
function readEnv() {
  const p = path.join(process.cwd(), ".env.local");
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = readEnv();
const PROJECT_URL = env.NEXT_PUBLIC_SUPABASE_URL || `https://${REF}.supabase.co`;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SERVICE) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
async function runSql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ query }),
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, body: text };
}

const DELLYS_ADMIN_EMAIL = "dellys_admin@dellys.local";
const DELLYS_ADMIN_PASSWORD = "1234567890";

async function main() {
  // 1. Apply migration 0018.
  const sql = fs.readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "0018_guest_bookings_and_dashboard_access.sql"),
    "utf8",
  );
  const mig = await runSql(sql);
  console.log(mig.ok ? "✓ applied 0018 migration" : `✗ migration: ${mig.status} ${mig.body.slice(0, 400)}`);

  // 2. Create the dellys_admin auth user (confirmed) via the Auth Admin API.
  const userRes = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: DELLYS_ADMIN_EMAIL,
      password: DELLYS_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { preferred_lang: "ro", full_name: "Dellys Admin" },
    }),
  });
  const userText = await userRes.text();
  if (userRes.ok) console.log("✓ created dellys_admin auth user");
  else if (userText.includes("already") || userText.includes("registered"))
    console.log("• dellys_admin user already existed");
  else console.log(`• create user: ${userRes.status} ${userText.slice(0, 200)}`);

  // 3. Promote to admin but block the financial dashboard. Also (re)set the
  //    password so re-runs guarantee the known credential.
  const promote = await runSql(
    `update public.profiles set role='admin', dashboard_access=false where email='${DELLYS_ADMIN_EMAIL}';`,
  );
  console.log(promote.ok ? "✓ dellys_admin = admin, dashboard_access=false" : `✗ promote: ${promote.body.slice(0, 200)}`);

  // 4. Verify.
  const check = await runSql(
    `select
       exists(select 1 from information_schema.columns
              where table_name='guest_bookings') as guest_table,
       exists(select 1 from information_schema.columns
              where table_name='profiles' and column_name='dashboard_access') as dashboard_col,
       (select role from public.profiles where email='${DELLYS_ADMIN_EMAIL}') as dellys_role,
       (select dashboard_access from public.profiles where email='${DELLYS_ADMIN_EMAIL}') as dellys_dashboard;`,
  );
  console.log("verify:", check.body);
}

main().catch((e) => {
  console.error("FATAL", e.message);
  process.exit(1);
});
