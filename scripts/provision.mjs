// One-shot provisioner. Run with SB_TOKEN, SB_REF, ADMIN_EMAIL env vars.
// Not committed; safe to delete after use.
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.SB_TOKEN;
const REF = process.env.SB_REF;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";
if (!TOKEN || !REF || !ADMIN_EMAIL) {
  console.error("Missing SB_TOKEN / SB_REF / ADMIN_EMAIL");
  process.exit(1);
}
const PROJECT_URL = `https://${REF}.supabase.co`;
const mgmt = (p) => `https://api.supabase.com/v1/projects/${REF}${p}`;
const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };

async function jpost(url, body, headers = H) {
  const r = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  const text = await r.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

async function runSql(query) {
  return jpost(mgmt(`/database/query`), { query });
}

async function main() {
  // 1. Fetch API keys.
  const keysRes = await fetch(mgmt(`/api-keys`), { headers: H });
  const keys = await keysRes.json();
  const anon = keys.find((k) => k.name === "anon")?.api_key;
  const service = keys.find((k) => k.name === "service_role")?.api_key;
  if (!anon || !service) throw new Error("Could not read anon/service keys");
  console.log("✓ fetched API keys");

  // 2. Write .env.local
  const env = [
    `NEXT_PUBLIC_SUPABASE_URL=${PROJECT_URL}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    `NEXT_PUBLIC_SITE_URL=${SITE_URL}`,
    "",
  ].join("\n");
  fs.writeFileSync("C:/Users/natas/OneDrive/Desktop/dellys-web/.env.local", env);
  console.log("✓ wrote .env.local");

  // 3. Apply migrations in order.
  const migDir = "C:/Users/natas/OneDrive/Desktop/dellys-web/supabase/migrations";
  const files = fs.readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(migDir, f), "utf8");
    const res = await runSql(sql);
    if (!res.ok) {
      console.error(`✗ ${f}: ${res.status} ${JSON.stringify(res.data).slice(0, 300)}`);
      // Continue; some statements (e.g. publication add) may already exist.
    } else {
      console.log(`✓ applied ${f}`);
    }
  }

  // 4. Configure auth: site URL, allow-list, and OTP email template w/ {{ .Token }}.
  const tmpl = `<h2 style="font-family:sans-serif;color:#d42f6b">Dellys</h2>
<p style="font-family:sans-serif">Codul tău de autentificare · Ваш код для входа:</p>
<p style="font-family:sans-serif;font-size:32px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
<p style="font-family:sans-serif;color:#888;font-size:12px">Expiră în 60 min · Истекает через 60 мин</p>`;
  const authRes = await fetch(mgmt(`/config/auth`), {
    method: "PATCH",
    headers: H,
    body: JSON.stringify({
      site_url: SITE_URL,
      uri_allow_list: `${SITE_URL},http://localhost:3000`,
      mailer_subjects_magic_link: "Codul Dellys · Код Dellys",
      mailer_templates_magic_link_content: tmpl,
      mailer_otp_exp: 3600,
    }),
  });
  console.log(authRes.ok ? "✓ configured auth email (OTP code template)" : `✗ auth config: ${authRes.status} ${(await authRes.text()).slice(0,200)}`);

  // 5. Create the admin auth user (confirmed) and promote to admin.
  if (process.env.DO_ADMIN !== "1") {
    console.log("• skipping admin creation (set DO_ADMIN=1 to enable)");
    const check0 = await runSql(
      `select (select count(*) from public.class_types) as class_types,
              (select count(*) from public.membership_plans) as plans;`,
    );
    console.log("counts:", JSON.stringify(check0.data));
    return;
  }
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
  const userRes = await jpost(
    `${PROJECT_URL}/auth/v1/admin/users`,
    {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { preferred_lang: "ro" },
    },
    { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json" },
  );
  if (userRes.ok || userRes.status === 200) {
    console.log("✓ created admin auth user");
  } else if (JSON.stringify(userRes.data).includes("already")) {
    console.log("• admin user already existed");
  } else {
    console.log(`• create user: ${userRes.status} ${JSON.stringify(userRes.data).slice(0,200)}`);
  }

  const promote = await runSql(
    `update public.profiles set role='admin' where email='${ADMIN_EMAIL.replace(/'/g, "''")}';`,
  );
  console.log(promote.ok ? "✓ promoted to admin" : `✗ promote: ${JSON.stringify(promote.data).slice(0,200)}`);

  // 6. Sanity check: counts.
  const check = await runSql(
    `select
       (select count(*) from public.class_types) as class_types,
       (select count(*) from public.membership_plans) as plans,
       (select count(*) from public.profiles where role='admin') as admins;`,
  );
  console.log("counts:", JSON.stringify(check.data));
}

main().catch((e) => { console.error("FATAL", e.message); process.exit(1); });
