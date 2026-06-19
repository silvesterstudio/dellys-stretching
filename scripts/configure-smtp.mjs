// Configure Supabase custom SMTP (Resend) + 6-digit OTP code template.
// Run with SB_TOKEN, SB_REF, RESEND_KEY, SENDER, SITE_URL env vars.
const TOKEN = process.env.SB_TOKEN;
const REF = process.env.SB_REF;
const RESEND_KEY = process.env.RESEND_KEY;
const SENDER = process.env.SENDER || "onboarding@resend.dev";
const SITE_URL = process.env.SITE_URL || "http://localhost:3000";

const tmpl = `<div style="font-family:sans-serif;max-width:420px;margin:auto">
  <h2 style="color:#d42f6b;margin-bottom:4px">Dellys</h2>
  <p style="color:#333">Codul tău de autentificare · Ваш код для входа:</p>
  <p style="font-size:34px;font-weight:bold;letter-spacing:8px;color:#111">{{ .Token }}</p>
  <p style="color:#999;font-size:12px">Expiră în 60 de minute · Истекает через 60 минут</p>
</div>`;

const body = {
  // Custom SMTP (Resend)
  smtp_host: "smtp.resend.com",
  smtp_port: "465",
  smtp_user: "resend",
  smtp_pass: RESEND_KEY,
  smtp_admin_email: SENDER,
  smtp_sender_name: "Dellys",
  // 6-digit code, valid 60 min
  mailer_otp_length: 6,
  mailer_otp_exp: 3600,
  // Show the code in both the magic-link and signup-confirmation emails
  mailer_subjects_magic_link: "Codul Dellys · Код Dellys",
  mailer_templates_magic_link_content: tmpl,
  mailer_subjects_confirmation: "Codul Dellys · Код Dellys",
  mailer_templates_confirmation_content: tmpl,
  // URLs
  site_url: SITE_URL,
  uri_allow_list: SITE_URL,
};

const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const text = await r.text();
console.log("HTTP", r.status);
if (!r.ok) {
  console.log(text.slice(0, 500));
  process.exit(1);
}
const c = JSON.parse(text);
console.log("✓ SMTP host:", c.smtp_host, "| sender:", c.smtp_admin_email);
console.log("✓ OTP length:", c.mailer_otp_length, "| exp(s):", c.mailer_otp_exp);
console.log("✓ template has {{ .Token }}:", (c.mailer_templates_magic_link_content || "").includes(".Token"));
