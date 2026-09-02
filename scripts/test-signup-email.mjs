// Can several people register one after another?
//
// Supabase's built-in mailer allows 2 emails an hour for the WHOLE project, so
// the third person to sign up in an afternoon used to be told "email rate limit
// exceeded". This drives the real /register path (anon key, signInWithOtp with
// shouldCreateUser) several times in a row and reports what came back, then
// removes the accounts it made.
//
// Also reads Resend's own log, so a failure can be told apart: a 429 from
// GoTrue is the cap, an accepted Resend message with a bounce is the throwaway
// recipient domain, and nothing in the log at all means mail never reached the
// provider.
//
//   RESEND_KEY=re_... node scripts/test-signup-email.mjs
//   (RESEND_KEY optional — without it the Resend log is skipped.)
//
// RUN THIS SPARINGLY. The addresses are @example.invalid, so every message it
// sends bounces, and a pile of bounces on a young sending domain is how a
// domain's reputation gets damaged. Three is the fewest that proves anything
// (the old wall was the third email), which is why that is the default.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { sweepTestData } from "./clean-test-data.mjs";

const env = {};
for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z_]+)=(.*)$/.exec(l.trim());
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const N = Number(process.argv[2] || 3);
const stamp = Date.now();
// Resend timestamps read "2026-09-02 17:27:52.752000+00" — a space, not a T,
// so comparing them against a raw ISO string silently matches nothing (' ' sorts
// below 'T'). Normalise to the same shape, and start a minute back for clock skew.
const since = new Date(Date.now() - 60000).toISOString().slice(0, 19).replace("T", " ");

let pass = 0,
  fail = 0;
const log = (ok, name, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✓" : "✗ FAIL"}  ${name}${detail ? "  — " + detail : ""}`);
};

async function main() {
  const results = [];
  try {
    for (let i = 1; i <= N; i++) {
      const email = `zz-signup-${i}-${stamp}@example.invalid`;
      const { error } = await anon.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          data: { full_name: `Signup ${i}`, preferred_lang: "ro" },
        },
      });
      const msg = `${error?.message ?? ""} ${error?.code ?? ""}`.toLowerCase();
      const limited = error?.status === 429 || msg.includes("rate limit") || msg.includes("over_email_send");
      results.push({ i, error: error?.message ?? null, limited });
      console.log(`  ${i}. ${error ? error.message : "sent"}`);
    }

    const limited = results.filter((r) => r.limited);
    log(limited.length === 0, `${N} registrations in a row, none hit the hourly cap`,
      limited.length ? `blocked from #${limited[0].i}` : "");

    // The old cap was 2/hour, so anything past the second going through at all
    // is the thing that was broken.
    log(results.length >= 3 && !results[2].limited, "the third one is not the wall it used to be");

    if (process.env.RESEND_KEY) {
      const r = await fetch("https://api.resend.com/emails?limit=20", {
        headers: { Authorization: `Bearer ${process.env.RESEND_KEY}` },
      });
      const body = await r.json().catch(() => null);
      if (!r.ok) console.log(`     resend: HTTP ${r.status}`);
      const rows = (body?.data ?? []).filter((e) => (e.created_at ?? "").slice(0, 19) >= since);
      log(rows.length > 0, "Supabase handed the mail to Resend", `${rows.length} message(s) in the log`);
      for (const e of rows.slice(0, N)) {
        console.log(`     ${e.created_at}  ${e.last_event ?? "?"}  ->  ${(e.to ?? []).join(",")}`);
      }
    }
  } finally {
    await sweepTestData({ quiet: true });
  }

  console.log();
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
