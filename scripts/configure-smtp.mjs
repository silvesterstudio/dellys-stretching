// Point Supabase Auth at Resend for outgoing mail.
//
// Run with SB_TOKEN (Supabase personal access token), SB_REF and RESEND_KEY.
// SENDER must be an address on a domain verified in Resend, or delivery fails.
//
//   PowerShell:  $env:SB_TOKEN="sbp_..."; $env:SB_REF="idkrwfldytvsqaoxdgyi"; $env:RESEND_KEY="re_..."; $env:SENDER="noreply@dellys.md"; node scripts/configure-smtp.mjs
//   bash:        SB_TOKEN=sbp_... SB_REF=idkrwfldytvsqaoxdgyi RESEND_KEY=re_... SENDER=noreply@dellys.md node scripts/configure-smtp.mjs
//
// Deliberately touches NOTHING but the SMTP settings and the magic-link mail.
// An earlier version of this script also rewrote site_url and set
// `uri_allow_list: SITE_URL` — a bare origin with no "/**", which silently
// invalidates every callback URL and drops signing-in members on the home page.
// The allow-list is already correct in the project; leave it alone.
const TOKEN = process.env.SB_TOKEN;
const REF = process.env.SB_REF;
const RESEND_KEY = process.env.RESEND_KEY;
const SENDER = process.env.SENDER;

if (!TOKEN || !REF || !RESEND_KEY || !SENDER) {
  console.error(
    "Missing env. Need SB_TOKEN, SB_REF, RESEND_KEY and SENDER\n" +
      "  (SENDER must be on a domain you have verified in Resend).",
  );
  process.exit(1);
}

// The app signs people in with a LINK, not a typed code, so the template must
// carry {{ .ConfirmationURL }}. Do not switch this to {{ .Token }} unless the
// login form grows a code input to match.
const tmpl = `<div style="font-family:sans-serif;max-width:440px;margin:auto">
  <h2 style="color:#d42f6b;margin-bottom:6px">Dellys</h2>
  <p style="color:#333">Apasă butonul de mai jos ca să te conectezi · Нажмите кнопку ниже, чтобы войти:</p>
  <p style="margin:18px 0"><a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#e84d86;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:bold">Conectează-te · Войти</a></p>
  <p style="color:#999;font-size:12px">Linkul expiră în 60 de minute · Ссылка действует 60 минут.</p>
</div>`;

const body = {
  smtp_host: "smtp.resend.com",
  smtp_port: "465",
  smtp_user: "resend",
  smtp_pass: RESEND_KEY,
  smtp_admin_email: SENDER,
  smtp_sender_name: "Dellys",
  mailer_otp_exp: 3600,
  mailer_subjects_magic_link: "Conectează-te la Dellys · Вход в Dellys",
  mailer_templates_magic_link_content: tmpl,
  mailer_subjects_confirmation: "Conectează-te la Dellys · Вход в Dellys",
  mailer_templates_confirmation_content: tmpl,
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
console.log("✓ SMTP host   :", c.smtp_host, "| sender:", c.smtp_admin_email);
console.log("✓ link template:", (c.mailer_templates_magic_link_content || "").includes("ConfirmationURL"));
console.log("• uri_allow_list (untouched):", c.uri_allow_list);
