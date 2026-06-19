// Set the magic-link email template and (optionally) revert to Supabase's
// built-in email provider. Run with SB_TOKEN, SB_REF, and optional USE_DEFAULT=1.
const TOKEN = process.env.SB_TOKEN;
const REF = process.env.SB_REF;
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

const tmpl = `<div style="font-family:sans-serif;max-width:440px;margin:auto">
  <h2 style="color:#d42f6b;margin-bottom:6px">Dellys</h2>
  <p style="color:#333">Apasă butonul de mai jos ca să te conectezi · Нажмите кнопку ниже, чтобы войти:</p>
  <p style="margin:18px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#e84d86;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Conectează-te · Войти</a></p>
  <p style="color:#999;font-size:12px">Linkul expiră în 60 de minute · Ссылка действует 60 минут.</p>
</div>`;

const body = {
  mailer_subjects_magic_link: "Conectează-te la Dellys · Вход в Dellys",
  mailer_templates_magic_link_content: tmpl,
  mailer_subjects_confirmation: "Conectează-te la Dellys · Вход в Dellys",
  mailer_templates_confirmation_content: tmpl,
  site_url: SITE_URL,
  uri_allow_list: `${SITE_URL},${SITE_URL}/**`,
};

// Revert to Supabase's built-in email service (reaches any recipient; rate-limited).
if (process.env.USE_DEFAULT === "1") {
  Object.assign(body, {
    smtp_host: null,
    smtp_port: null,
    smtp_user: null,
    smtp_pass: null,
    smtp_admin_email: null,
    smtp_sender_name: null,
  });
}

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = await r.text();
console.log("HTTP", r.status);
if (!r.ok) { console.log(text.slice(0, 600)); process.exit(1); }
const c = JSON.parse(text);
console.log("✓ magic-link template set:", (c.mailer_templates_magic_link_content || "").includes("ConfirmationURL"));
console.log("✓ smtp_host:", JSON.stringify(c.smtp_host), "(empty = Supabase built-in email)");
console.log("✓ uri_allow_list:", c.uri_allow_list);
