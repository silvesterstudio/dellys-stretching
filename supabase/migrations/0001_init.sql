-- ============================================================================
-- Dellys — initial schema, RLS, and booking RPCs
-- ============================================================================
-- Design notes:
--  * All instants are timestamptz (UTC under the hood); display is pinned to
--    Europe/Bucharest in the app layer.
--  * sessions.booked_count is the single source of truth for occupancy and is
--    ONLY mutated by the SECURITY DEFINER RPCs below (book/cancel), which take a
--    row lock to make the last-seat race impossible.
--  * RLS: clients see only their own rows; admins see all. The admin flag lives
--    in profiles.role and is protected from self-escalation by a trigger.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- class_types
-- ---------------------------------------------------------------------------
create table public.class_types (
  id               uuid primary key default gen_random_uuid(),
  key              text unique not null,
  audience         text not null check (audience in ('adult','child')),
  name_ro          text not null,
  name_ru          text not null,
  description_ro   text,
  description_ru   text,
  color            text not null default '#e84d86',
  default_capacity int  not null default 11 check (default_capacity > 0),
  active           boolean not null default true,
  created_at       timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- weekly_templates — the repeating schedule the admin edits
-- ---------------------------------------------------------------------------
create table public.weekly_templates (
  id            uuid primary key default gen_random_uuid(),
  class_type_id uuid not null references public.class_types(id) on delete cascade,
  weekday       int  not null check (weekday between 0 and 6), -- 0=Sun..6=Sat
  start_time    text not null,        -- "HH:MM" local (Europe/Bucharest)
  duration_min  int  not null default 60 check (duration_min > 0),
  capacity      int  not null default 11 check (capacity > 0),
  instructor    text,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
create index on public.weekly_templates (weekday) where active;

-- ---------------------------------------------------------------------------
-- sessions — concrete materialized class instances
-- ---------------------------------------------------------------------------
create table public.sessions (
  id            uuid primary key default gen_random_uuid(),
  class_type_id uuid not null references public.class_types(id) on delete restrict,
  template_id   uuid references public.weekly_templates(id) on delete set null,
  starts_at     timestamptz not null,
  duration_min  int  not null default 60 check (duration_min > 0),
  capacity      int  not null default 11 check (capacity > 0),
  instructor    text,
  status        text not null default 'scheduled' check (status in ('scheduled','cancelled')),
  booked_count  int  not null default 0 check (booked_count >= 0),
  created_at    timestamptz not null default now()
);
create index on public.sessions (starts_at);
-- Prevent a template from generating two sessions for the same instant.
create unique index sessions_template_starts_uniq
  on public.sessions (template_id, starts_at) where template_id is not null;

-- ---------------------------------------------------------------------------
-- profiles — one per auth user
-- ---------------------------------------------------------------------------
create table public.profiles (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          text not null,
  full_name      text,
  phone          text,
  preferred_lang text not null default 'ro' check (preferred_lang in ('ro','ru')),
  role           text not null default 'client' check (role in ('client','admin')),
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- children — kids attached to a parent profile (for gimnastica)
-- ---------------------------------------------------------------------------
create table public.children (
  id         uuid primary key default gen_random_uuid(),
  parent_id  uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  birth_year int check (birth_year between 1990 and 2100),
  created_at timestamptz not null default now()
);
create index on public.children (parent_id);

-- ---------------------------------------------------------------------------
-- membership_plans — the price list (sold at reception)
-- ---------------------------------------------------------------------------
create table public.membership_plans (
  id            uuid primary key default gen_random_uuid(),
  audience      text not null check (audience in ('adult','child')),
  name_ro       text not null,
  name_ru       text not null,
  session_count int  not null check (session_count > 0),
  price         numeric(10,2) not null check (price >= 0),
  currency      text not null default 'MDL',
  validity_days int  not null default 30 check (validity_days > 0),
  active        boolean not null default true,
  sort_order    int  not null default 0,
  created_at    timestamptz not null default now(),
  unique (audience, name_ro)
);

-- ---------------------------------------------------------------------------
-- user_memberships — a purchased bundle assigned to a client by an admin
-- ---------------------------------------------------------------------------
create table public.user_memberships (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles(id) on delete cascade,
  plan_id            uuid not null references public.membership_plans(id) on delete restrict,
  sessions_remaining int  not null check (sessions_remaining >= 0),
  expires_at         timestamptz not null,
  assigned_by        uuid references public.profiles(id) on delete set null,
  note               text,
  created_at         timestamptz not null default now()
);
create index on public.user_memberships (user_id);

-- ---------------------------------------------------------------------------
-- bookings
-- ---------------------------------------------------------------------------
create table public.bookings (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.sessions(id) on delete cascade,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  child_id      uuid references public.children(id) on delete set null,
  status        text not null default 'booked'
                  check (status in ('pending','booked','attended','no_show','cancelled')),
  membership_id uuid references public.user_memberships(id) on delete set null,
  expires_at    timestamptz, -- reserved for future pre-auth holds
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index on public.bookings (session_id);
create index on public.bookings (user_id);
-- A user cannot hold two ACTIVE bookings for the same session (per child).
-- Partial unique index over active statuses; cancelled/no_show don't block rebooking.
create unique index bookings_active_uniq
  on public.bookings (session_id, user_id, coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where status in ('pending','booked','attended');
