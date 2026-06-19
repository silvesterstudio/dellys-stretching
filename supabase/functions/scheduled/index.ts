// Supabase Edge Function — scheduled maintenance for Dellys.
// Materializes upcoming sessions from templates and releases stale pending seats.
//
// Deploy:   supabase functions deploy scheduled --no-verify-jwt
// Schedule: in the Supabase dashboard (Edge Functions -> Schedules), e.g. hourly,
//           or trigger from an external cron hitting this function's URL.
//
// It uses the service role key (server-only) so it can run the RPCs without a
// user session. generate_sessions allows a null auth.uid() (service context).

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const generated = await supabase.rpc("generate_sessions", { p_weeks: 4 });
  const released = await supabase.rpc("release_stale_pending");

  const body = {
    generated: generated.data ?? null,
    released: released.data ?? null,
    errors: [generated.error?.message, released.error?.message].filter(Boolean),
  };

  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
    status: body.errors.length ? 500 : 200,
  });
});
