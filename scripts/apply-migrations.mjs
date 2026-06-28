// Apply specific migrations to the live Supabase DB via the Management API.
// Needs a Supabase personal access token (https://supabase.com/dashboard/account/tokens).
//
// Usage (PowerShell):
//   $env:SB_TOKEN="sbp_xxx"; node scripts/apply-migrations.mjs
// Usage (bash):
//   SB_TOKEN=sbp_xxx node scripts/apply-migrations.mjs
//
// Applies only the migrations listed in FILES below, in order. Idempotent.
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.SB_TOKEN;
const REF = process.env.SB_REF || "idkrwfldytvsqaoxdgyi";
if (!TOKEN) {
  console.error("Missing SB_TOKEN (Supabase personal access token).");
  process.exit(1);
}

const FILES = ["0008_freeze_and_signup.sql"];
const migDir = path.join(process.cwd(), "supabase", "migrations");
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

for (const f of FILES) {
  const sql = fs.readFileSync(path.join(migDir, f), "utf8");
  const res = await runSql(sql);
  console.log(res.ok ? `✓ applied ${f}` : `✗ ${f}: ${res.status} ${res.body.slice(0, 300)}`);
}

// Sanity check — confirm the 0008 changes are live in the DB.
const check = await runSql(
  `select
     exists(select 1 from information_schema.columns
            where table_name='user_memberships' and column_name='frozen') as frozen_col,
     pg_get_functiondef('public.handle_new_user()'::regprocedure)
       ilike '%full_name%' as signup_name,
     pg_get_functiondef('public.book_session(uuid,uuid)'::regprocedure)
       ilike '%not frozen%' as book_frozen;`,
);
console.log("verify:", check.body);
