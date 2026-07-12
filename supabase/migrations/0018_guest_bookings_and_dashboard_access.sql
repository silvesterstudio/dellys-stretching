-- Dellys — 0018 guest booking funnel + restricted-admin dashboard flag + live admin
--
-- 1. guest_bookings: anonymous "first reservation" leads captured from the public
--    schedule (full name + phone + which class). No account, no seat decrement —
--    the server action stores the lead (service role) and forwards it to an
--    external messaging automation (webhook). Staff can also see/action them.
-- 2. profiles.dashboard_access: lets an admin account be blocked from the
--    financial dashboard (/admin/dashboard) while keeping every other admin power.
-- 3. Realtime: expose bookings / user_memberships / guest_bookings so admin views
--    update live without a manual refresh.

-- ---------------------------------------------------------------------------
-- 1. Guest booking leads
-- ---------------------------------------------------------------------------
create table if not exists public.guest_bookings (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid references public.sessions(id) on delete set null,
  full_name  text not null,
  phone      text not null,
  status     text not null default 'new' check (status in ('new','contacted','confirmed','cancelled')),
  lang       text not null default 'ro' check (lang in ('ro','ru')),
  -- Denormalised snapshot so a later session edit/delete still shows what the
  -- lead actually asked for (and the automation payload can be rebuilt).
  class_name text,
  starts_at  timestamptz,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists guest_bookings_created_idx on public.guest_bookings (created_at desc);
create index if not exists guest_bookings_session_idx on public.guest_bookings (session_id);

alter table public.guest_bookings enable row level security;

-- Inserts happen through the service role (server action), so no anon insert
-- policy. Staff (admin/reception) may read and update the pipeline status.
drop policy if exists "guest_bookings staff read" on public.guest_bookings;
create policy "guest_bookings staff read" on public.guest_bookings
  for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','reception'))
  );

drop policy if exists "guest_bookings staff update" on public.guest_bookings;
create policy "guest_bookings staff update" on public.guest_bookings
  for update using (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('admin','reception'))
  );

-- ---------------------------------------------------------------------------
-- 2. Restricted-admin dashboard flag
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists dashboard_access boolean not null default true;

-- ---------------------------------------------------------------------------
-- 3. Realtime — add tables to the publication only if not already present
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'guest_bookings'
  ) then
    alter publication supabase_realtime add table public.guest_bookings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_memberships'
  ) then
    alter publication supabase_realtime add table public.user_memberships;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'membership_requests'
  ) then
    alter publication supabase_realtime add table public.membership_requests;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
end
$$;
