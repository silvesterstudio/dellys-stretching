// Applies migration 0024 (locations + QR check-in), provisions the Moscova
// studio's own admin account, and prints the two kiosk device links.
//
// Usage (PowerShell):
//   $env:SB_TOKEN="sbp_xxx"; node scripts/setup-0024.mjs
// Usage (bash):
//   SB_TOKEN=sbp_xxx node scripts/setup-0024.mjs
//
// SB_TOKEN = Supabase personal access token (https://supabase.com/dashboard/account/tokens).
// Service role key + project URL are read from .env.local. Idempotent — safe to
// re-run; it never overwrites an existing account or rotates a live token.
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.SB_TOKEN;
const REF = process.env.SB_REF || "idkrwfldytvsqaoxdgyi";
// Change these before running, or pass them as env vars.
const MOSCOVA_USER = process.env.MOSCOVA_USER || "moscova_admin";
const MOSCOVA_PASS = process.env.MOSCOVA_PASS || "";

if (!TOKEN) {
  console.error("Missing SB_TOKEN (Supabase personal access token).");
  process.exit(1);
}
if (!MOSCOVA_PASS) {
  console.error(
    "Missing MOSCOVA_PASS — set the password for the Moscova admin account.\n" +
      '  PowerShell:  $env:MOSCOVA_PASS="..."\n' +
      "  bash:        MOSCOVA_PASS=... node scripts/setup-0024.mjs",
  );
  process.exit(1);
}

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
const SITE_URL = env.NEXT_PUBLIC_SITE_URL || "https://dellys.md";
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
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { ok: r.ok, status: r.status, data };
}

// --- 1. Apply the migration ------------------------------------------------
const file = "0024_locations_and_qr_checkin.sql";
const sql = fs.readFileSync(path.join(process.cwd(), "supabase", "migrations", file), "utf8");
const applied = await runSql(sql);
if (!applied.ok) {
  console.error(`✗ ${file}: ${applied.status}`, JSON.stringify(applied.data).slice(0, 800));
  process.exit(1);
}
console.log(`✓ applied ${file}`);

// --- 2. Verify the pieces that matter --------------------------------------
const check = await runSql(`
  select
    (select count(*) from public.locations)                        as locations,
    (select count(*) from public.kiosk_devices)                    as devices,
    (select count(*) from public.profiles where qr_uuid is not null) as members_with_qr,
    (select count(*) from public.profiles where qr_uuid is null)     as members_without_qr,
    to_regprocedure('public.kiosk_scan(text,uuid,text)') is not null as has_kiosk_scan,
    pg_get_functiondef('public.book_session(uuid,uuid)'::regprocedure)
      ilike '%WRONG_LOCATION%'                                      as book_location_guard;
`);
console.log("verify:", JSON.stringify(check.data));

// --- 3. Provision the Moscova studio's admin -------------------------------
// Staff sign in with a username; it maps to a synthetic internal email.
const email = `${MOSCOVA_USER}@dellys.local`;
const created = await fetch(`${PROJECT_URL}/auth/v1/admin/users`, {
  method: "POST",
  headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    email,
    password: MOSCOVA_PASS,
    email_confirm: true,
    user_metadata: { full_name: "Administrator Moscova", preferred_lang: "ro" },
  }),
});
if (created.ok) {
  console.log(`✓ created staff account ${MOSCOVA_USER}`);
} else {
  const body = await created.text();
  const exists = body.includes("already") || body.includes("registered") || created.status === 422;
  console.log(exists ? `• staff account ${MOSCOVA_USER} already exists` : `✗ account: ${body.slice(0, 300)}`);
}

// Pin the account to Moscova. location_id is what scopes every admin screen;
// the original `admin` account keeps location_id NULL = sees both studios.
const pin = await runSql(`
  update public.profiles p
     set role = 'admin',
         location_id = (select id from public.locations where key = 'moscova')
   where p.email = '${email}'
  returning p.id, p.email, p.role, p.location_id;
`);
console.log("pinned:", JSON.stringify(pin.data));

// --- 4. Print the kiosk links ----------------------------------------------
const devices = await runSql(`
  select l.name, l.key, d.token
    from public.kiosk_devices d
    join public.locations l on l.id = d.location_id
   where d.active
   order by l.sort_order;
`);
console.log("\nOpen these once on each entrance tablet — the token is then stored on the device:");
for (const d of Array.isArray(devices.data) ? devices.data : []) {
  console.log(`  ${d.name}: ${SITE_URL}/kiosk?token=${d.token}`);
}
console.log(
  "\nAnyone holding a kiosk link can record entries — treat it like a key.\n" +
    "Rotate one with:  update public.kiosk_devices set token = encode(gen_random_bytes(16),'hex') where location_id = '<id>';",
);
