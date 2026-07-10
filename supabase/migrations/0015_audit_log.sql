-- ============================================================================
-- Dellys — audit log (Bundle D)
--   Append-only record of who did what in the admin panel. Written by server
--   actions via the service role (RLS-bypassing) after the caller is verified;
--   readable only by admins. Never updated or deleted by the app.
-- ============================================================================
create table if not exists public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  actor_email text,
  action      text not null,           -- e.g. 'membership.assign', 'checkin.undo'
  target_type text,                    -- e.g. 'membership', 'booking', 'member'
  target_id   text,
  detail      jsonb,                   -- small context blob (amounts, names, …)
  created_at  timestamptz not null default now()
);
create index if not exists audit_log_created_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log
  for select using (public.is_admin());
-- Inserts go through the service-role client, which bypasses RLS — no insert
-- policy is granted, so nothing can forge audit rows through the anon/auth API.
