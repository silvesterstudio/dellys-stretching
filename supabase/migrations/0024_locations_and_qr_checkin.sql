-- ============================================================================
-- Dellys — multi-location + QR self check-in
-- ============================================================================
-- Two things land together because they are entangled: a scan must resolve to a
-- class AT THE TABLET'S GYM, so check-in cannot be built before locations exist.
--
--   1. locations           — Asachi 65 (existing) + Moscova 6 et.3 (new).
--   2. location_id         — on sessions, weekly_templates, membership_plans and
--                            profiles. The two gyms are run as SEPARATE
--                            operations: a member belongs to one gym and a
--                            membership is only valid at the gym that sold it.
--   3. profiles.qr_uuid    — the member's permanent QR identity (bearer token,
--                            so it is random and unguessable, not the user id).
--   4. kiosk_devices       — a tablet's token; this is what pins a kiosk to a
--                            gym, so a scan can never check someone into the
--                            other location.
--   5. checkin_logs        — every scan, accepted or refused, with the reason.
--   6. kiosk_scan()        — the whole front-door decision in one atomic RPC.
--
-- Business rules kiosk_scan reproduces from the manual admin check-in
-- (check_in_booking), so the tablet and the front desk can never disagree:
--   * a membership must match the class audience, be unexpired, unfrozen and
--     have sessions left;
--   * the first attendance in a category consumes that category's free trial —
--     which is exactly what "check in with no membership" means today.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. locations
-- ---------------------------------------------------------------------------
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,
  name        text not null,
  address_ro  text not null default '',
  address_ru  text not null default '',
  phone       text,
  maps_url    text,
  active      boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

insert into public.locations (key, name, address_ro, address_ru, sort_order) values
  ('asachi',  'Dellys Asachi',  'str. Gheorghe Asachi 65, Chișinău',   'ул. Георге Асаки 65, Кишинэу',        1),
  ('moscova', 'Dellys Moscova', 'bd. Moscova 6, et. 3, Chișinău',      'бул. Московя 6, эт. 3, Кишинэу',      2)
on conflict (key) do nothing;

alter table public.locations enable row level security;

-- Anyone may read the gym list — the public booking page needs it to render the
-- location tabs. Only admins may change it.
drop policy if exists locations_read on public.locations;
create policy locations_read on public.locations
  for select using (true);

drop policy if exists locations_write on public.locations;
create policy locations_write on public.locations
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- 2. location_id everywhere it matters
-- ---------------------------------------------------------------------------
-- Everything that exists today belongs to the original studio.
-- NOT NULL and deliberately WITHOUT a default: a forgotten insert path must
-- fail loudly rather than silently file a class under the wrong gym.

-- weekly_templates ----------------------------------------------------------
alter table public.weekly_templates
  add column if not exists location_id uuid references public.locations(id) on delete restrict;
update public.weekly_templates
   set location_id = (select id from public.locations where key = 'asachi')
 where location_id is null;
alter table public.weekly_templates alter column location_id set not null;
create index if not exists weekly_templates_location_idx
  on public.weekly_templates (location_id, weekday) where active;

-- sessions ------------------------------------------------------------------
alter table public.sessions
  add column if not exists location_id uuid references public.locations(id) on delete restrict;
update public.sessions
   set location_id = (select id from public.locations where key = 'asachi')
 where location_id is null;
alter table public.sessions alter column location_id set not null;
create index if not exists sessions_location_starts_idx
  on public.sessions (location_id, starts_at);

-- membership_plans ----------------------------------------------------------
-- Memberships are per gym, so the price list is per gym too.
alter table public.membership_plans
  add column if not exists location_id uuid references public.locations(id) on delete restrict;
update public.membership_plans
   set location_id = (select id from public.locations where key = 'asachi')
 where location_id is null;
alter table public.membership_plans alter column location_id set not null;
-- The old uniqueness was (audience, name_ro) — global across the business, which
-- would stop the second studio from ever selling a plan by the same name.
-- Replace it with the same rule scoped per gym.
--
-- It exists in two shapes: the inline table constraint from 0001, and a
-- hand-made index of the same columns that was created directly against the
-- database and never checked in. Both must go, or "8 ședințe" can only exist at
-- one studio.
alter table public.membership_plans drop constraint if exists membership_plans_audience_name_ro_key;
alter table public.membership_plans drop constraint if exists membership_plans_audience_name_uniq;
drop index if exists public.membership_plans_audience_name_uniq;
create unique index if not exists membership_plans_loc_aud_name_uniq
  on public.membership_plans (location_id, audience, name_ro);

-- profiles ------------------------------------------------------------------
-- For a client this is their home gym. For staff it is the gym they run;
-- NULL means "all gyms" (the existing super-admin keeps global access).
alter table public.profiles
  add column if not exists location_id uuid references public.locations(id) on delete set null;
update public.profiles
   set location_id = (select id from public.locations where key = 'asachi')
 where location_id is null and role = 'client';
create index if not exists profiles_location_idx on public.profiles (location_id);

-- ---------------------------------------------------------------------------
-- 3. profiles.qr_uuid — the member's permanent QR identity
-- ---------------------------------------------------------------------------
-- This string is a bearer credential: whoever presents it gets checked in. It
-- must therefore be random (12 bytes = 96 bits), never derived from the user id
-- or name, and never enumerable.
-- search_path MUST name `extensions`: pgcrypto's gen_random_bytes lives there on
-- Supabase, and this function is reached from handle_new_user(), which pins
-- `search_path = public`. Without this the qr_uuid column default cannot resolve
-- gen_random_bytes and EVERY new auth user fails with "Database error creating
-- new user".
create or replace function public.gen_qr_token()
returns text
language sql
volatile
set search_path = public, extensions
as $$
  select encode(gen_random_bytes(12), 'hex');
$$;

alter table public.profiles add column if not exists qr_uuid text;
update public.profiles set qr_uuid = public.gen_qr_token() where qr_uuid is null;
alter table public.profiles alter column qr_uuid set default public.gen_qr_token();
alter table public.profiles alter column qr_uuid set not null;
create unique index if not exists profiles_qr_uuid_uniq on public.profiles (qr_uuid);

-- New signups get a token from the column default; handle_new_user is updated
-- so the explicit column list keeps working unchanged.

-- ---------------------------------------------------------------------------
-- 4. kiosk_devices — what pins a tablet to one gym
-- ---------------------------------------------------------------------------
create table if not exists public.kiosk_devices (
  id           uuid primary key default gen_random_uuid(),
  token        text unique not null,
  label        text,
  location_id  uuid not null references public.locations(id) on delete cascade,
  active       boolean not null default true,
  last_seen_at timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists kiosk_devices_location_idx on public.kiosk_devices (location_id);

alter table public.kiosk_devices enable row level security;
-- No policy at all: this table is reachable only by the service role. A leaked
-- device token is a free check-in, so clients must never be able to list them.

-- One tablet per gym to start with. Rotate with:
--   update public.kiosk_devices set token = encode(gen_random_bytes(16),'hex') where label = '...';
insert into public.kiosk_devices (token, label, location_id)
select encode(gen_random_bytes(16), 'hex'), 'Tabletă recepție — ' || l.name, l.id
  from public.locations l
 where not exists (select 1 from public.kiosk_devices d where d.location_id = l.id);

-- ---------------------------------------------------------------------------
-- 5. checkin_logs — an audit line for every scan, accepted or refused
-- ---------------------------------------------------------------------------
create table if not exists public.checkin_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete set null,
  booking_id    uuid references public.bookings(id) on delete set null,
  session_id    uuid references public.sessions(id) on delete set null,
  location_id   uuid references public.locations(id) on delete set null,
  membership_id uuid references public.user_memberships(id) on delete set null,
  device_id     text,
  result        text not null,
  created_at    timestamptz not null default now()
);
create index if not exists checkin_logs_created_idx  on public.checkin_logs (created_at desc);
create index if not exists checkin_logs_location_idx on public.checkin_logs (location_id, created_at desc);
create index if not exists checkin_logs_user_idx     on public.checkin_logs (user_id, created_at desc);

alter table public.checkin_logs enable row level security;
drop policy if exists checkin_logs_read on public.checkin_logs;
create policy checkin_logs_read on public.checkin_logs
  for select using (user_id = auth.uid() or public.is_admin());
-- Writes happen only inside kiosk_scan (definer) / the service role.

-- ---------------------------------------------------------------------------
-- 6. generate_sessions — carry the template's gym onto the session
-- ---------------------------------------------------------------------------
create or replace function public.generate_sessions(p_weeks int default 4)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.sessions
    (class_type_id, template_id, starts_at, duration_min, capacity, instructor, location_id)
  select
    t.class_type_id,
    t.id,
    (gs.d::date + t.start_time::time) at time zone 'Europe/Chisinau',
    t.duration_min,
    t.capacity,
    t.instructor,
    t.location_id
  from public.weekly_templates t
  cross join generate_series(
    current_date::timestamp,
    (current_date + (p_weeks * 7))::timestamp,
    interval '1 day'
  ) as gs(d)
  where t.active
    and extract(dow from gs.d)::int = t.weekday
    and ((gs.d::date + t.start_time::time) at time zone 'Europe/Chisinau') > now()
  on conflict (template_id, starts_at) where template_id is not null
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- 7. kiosk_scan — the front door
-- ---------------------------------------------------------------------------
-- Small helper so every exit path is logged without repeating the insert.
create or replace function public._kiosk_log(
  p_user       uuid,
  p_booking    uuid,
  p_session    uuid,
  p_location   uuid,
  p_membership uuid,
  p_device     text,
  p_result     text,
  p_payload    jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.checkin_logs
    (user_id, booking_id, session_id, location_id, membership_id, device_id, result)
  values
    (p_user, p_booking, p_session, p_location, p_membership, p_device, p_result);
  return p_payload;
end;
$$;

create or replace function public.kiosk_scan(
  p_qr       text,
  p_location uuid,
  p_device   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user     public.profiles%rowtype;
  v_booking  public.bookings%rowtype;
  v_session  public.sessions%rowtype;
  v_ct       public.class_types%rowtype;
  v_mem_id   uuid;
  v_home     text;
  v_walkin   boolean := false;
  v_trial    boolean := false;
  v_left     int;
  v_now      timestamptz := now();
begin
  -- 1. Who is this? ---------------------------------------------------------
  select * into v_user from public.profiles where qr_uuid = p_qr;
  if not found then
    return public._kiosk_log(null, null, null, p_location, null, p_device, 'not_found',
      jsonb_build_object('ok', false, 'code', 'not_found'));
  end if;

  -- 2. Right gym? -----------------------------------------------------------
  -- The two studios are run separately: a member's account lives at one of them.
  if v_user.location_id is not null and v_user.location_id <> p_location then
    select name into v_home from public.locations where id = v_user.location_id;
    return public._kiosk_log(v_user.id, null, null, p_location, null, p_device, 'wrong_location',
      jsonb_build_object('ok', false, 'code', 'wrong_location',
                         'clientName', v_user.full_name, 'homeLocation', v_home));
  end if;

  -- 3. A reserved seat around now, at this gym ------------------------------
  -- Widest sensible arrival window: an hour early through half an hour late.
  select b.* into v_booking
    from public.bookings b
    join public.sessions s on s.id = b.session_id
   where b.user_id = v_user.id
     and s.location_id = p_location
     and s.status = 'scheduled'
     and b.status in ('booked', 'pending')
     and s.starts_at between v_now - interval '90 minutes'
                         and v_now + interval '60 minutes'
   order by abs(extract(epoch from (s.starts_at - v_now)))
   limit 1;

  if found then
    select * into v_session from public.sessions where id = v_booking.session_id;
  else
    -- 3b. Already scanned for this slot? Say so instead of pulling them into
    -- another class.
    if exists (
      select 1 from public.bookings b
        join public.sessions s on s.id = b.session_id
       where b.user_id = v_user.id
         and s.location_id = p_location
         and b.status = 'attended'
         and s.starts_at between v_now - interval '90 minutes'
                             and v_now + interval '60 minutes'
    ) then
      return public._kiosk_log(v_user.id, null, null, p_location, null, p_device, 'already_checked_in',
        jsonb_build_object('ok', false, 'code', 'already_checked_in',
                           'clientName', v_user.full_name));
    end if;

    -- 3c. Walk-in: no reservation. Take the class starting nearest to now that
    -- still has a seat AND that this member can actually pay for.
    v_walkin := true;
    select s.* into v_session
      from public.sessions s
      join public.class_types ct on ct.id = s.class_type_id
     where s.location_id = p_location
       and s.status = 'scheduled'
       and s.booked_count < s.capacity
       and s.starts_at between v_now - interval '20 minutes'
                           and v_now + interval '45 minutes'
       and (
         exists (
           select 1 from public.user_memberships m
             join public.membership_plans p on p.id = m.plan_id
            where m.user_id = v_user.id
              and not m.frozen
              and m.expires_at > v_now
              and m.sessions_remaining > 0
              and p.audience = ct.audience
              and p.location_id = p_location
         )
         or not exists (
           select 1 from public.free_trial_usage f
            where f.user_id = v_user.id and f.category = ct.category
         )
       )
     order by abs(extract(epoch from (s.starts_at - v_now)))
     limit 1
     for update of s;

    if not found then
      -- Nothing matched. Say WHY, in the order the member can act on: is there
      -- no class at all, is it full, or can they simply not pay for it? Without
      -- this ladder a full class reports "no class now" and the member stands
      -- in front of one that is visibly running.
      if not exists (
        select 1 from public.sessions s
         where s.location_id = p_location
           and s.status = 'scheduled'
           and s.starts_at between v_now - interval '20 minutes'
                               and v_now + interval '45 minutes'
      ) then
        return public._kiosk_log(v_user.id, null, null, p_location, null, p_device, 'no_class',
          jsonb_build_object('ok', false, 'code', 'no_class',
                             'clientName', v_user.full_name));
      end if;

      if not exists (
        select 1 from public.sessions s
         where s.location_id = p_location
           and s.status = 'scheduled'
           and s.booked_count < s.capacity
           and s.starts_at between v_now - interval '20 minutes'
                               and v_now + interval '45 minutes'
      ) then
        return public._kiosk_log(v_user.id, null, null, p_location, null, p_device, 'class_full',
          jsonb_build_object('ok', false, 'code', 'class_full',
                             'clientName', v_user.full_name));
      end if;

      -- A class is running with a free seat, so the blocker is payment.
      return public._kiosk_log(v_user.id, null, null, p_location, null, p_device, 'no_membership',
        jsonb_build_object('ok', false, 'code', 'no_membership',
                           'clientName', v_user.full_name));
    end if;

    -- Re-check occupancy under the row lock we just took.
    if v_session.booked_count >= v_session.capacity then
      return public._kiosk_log(v_user.id, null, v_session.id, p_location, null, p_device, 'class_full',
        jsonb_build_object('ok', false, 'code', 'class_full',
                           'clientName', v_user.full_name));
    end if;
  end if;

  select * into v_ct from public.class_types where id = v_session.class_type_id;

  -- 4. How is this session paid for? ----------------------------------------
  -- Soonest-expiring usable bundle first, so nothing is wasted. Locked so two
  -- tablets (or a tablet and the front desk) can't spend the same session.
  select m.id into v_mem_id
    from public.user_memberships m
    join public.membership_plans p on p.id = m.plan_id
   where m.user_id = v_user.id
     and not m.frozen
     and m.expires_at > v_now
     and m.sessions_remaining > 0
     and p.audience = v_ct.audience
     and p.location_id = p_location
   order by m.expires_at asc
   limit 1
   for update of m;

  if v_mem_id is null then
    -- No bundle. The one free introductory session per category is exactly what
    -- "check in without deducting" means at the front desk today.
    if exists (
      select 1 from public.free_trial_usage f
       where f.user_id = v_user.id and f.category = v_ct.category
    ) then
      return public._kiosk_log(v_user.id, v_booking.id, v_session.id, p_location, null, p_device, 'no_membership',
        jsonb_build_object('ok', false, 'code', 'no_membership',
                           'clientName', v_user.full_name));
    end if;
    v_trial := true;
  end if;

  -- 5. Seat the walk-in ------------------------------------------------------
  if v_walkin then
    insert into public.bookings (session_id, user_id, status, membership_id)
    values (v_session.id, v_user.id, 'booked', v_mem_id)
    returning * into v_booking;

    update public.sessions
       set booked_count = booked_count + 1
     where id = v_session.id;
  end if;

  -- 6. Attend ----------------------------------------------------------------
  if v_mem_id is not null then
    update public.user_memberships
       set sessions_remaining = sessions_remaining - 1
     where id = v_mem_id
     returning sessions_remaining into v_left;
  end if;

  update public.bookings
     set status = 'attended', membership_id = v_mem_id
   where id = v_booking.id;

  -- First attendance in a category burns that category's free trial.
  insert into public.free_trial_usage (user_id, category)
  values (v_user.id, v_ct.category)
  on conflict (user_id, category) do nothing;

  return public._kiosk_log(v_user.id, v_booking.id, v_session.id, p_location, v_mem_id, p_device, 'ok',
    jsonb_build_object(
      'ok',                true,
      'code',              'ok',
      'clientName',        v_user.full_name,
      'className_ro',      v_ct.name_ro,
      'className_ru',      v_ct.name_ru,
      'color',             v_ct.color,
      'startsAt',          v_session.starts_at,
      'walkIn',            v_walkin,
      'freeTrial',         v_trial,
      'sessionsRemaining', v_left
    ));
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. book_session — a member books only at their own gym
-- ---------------------------------------------------------------------------
-- Without this a member of one studio could reserve a seat at the other and
-- then be refused at its door, having burned a seat someone else could have
-- taken. Verbatim from the 0008 definition apart from the location guard and a
-- location-scoped membership probe.
create or replace function public.book_session(
  p_session_id uuid,
  p_child_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_session   public.sessions%rowtype;
  v_audience  text;
  v_booking   uuid;
  v_open      int;
  v_has_mem   boolean;
  v_home      uuid;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'SESSION_NOT_FOUND';
  end if;
  if v_session.status <> 'scheduled' then
    raise exception 'SESSION_CANCELLED';
  end if;
  if v_session.starts_at <= now() then
    raise exception 'PAST_SESSION';
  end if;

  -- The two studios are run as separate operations. A profile with no home gym
  -- (staff, or a member predating the split) is left unrestricted.
  select location_id into v_home from public.profiles where id = v_user;
  if v_home is not null and v_home <> v_session.location_id then
    raise exception 'WRONG_LOCATION';
  end if;

  select audience into v_audience from public.class_types where id = v_session.class_type_id;

  if v_audience = 'child' then
    if p_child_id is null then
      raise exception 'CHILD_REQUIRED';
    end if;
    if not exists (select 1 from public.children where id = p_child_id and parent_id = v_user) then
      raise exception 'INVALID_CHILD';
    end if;
  else
    p_child_id := null;
  end if;

  if exists (
    select 1 from public.bookings
    where session_id = p_session_id and user_id = v_user
      and status in ('pending','booked','attended')
      and coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(p_child_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) then
    raise exception 'ALREADY_BOOKED';
  end if;

  if v_session.booked_count >= v_session.capacity then
    raise exception 'SESSION_FULL';
  end if;

  -- Only a bundle sold by THIS gym lifts the no-membership booking cap.
  select exists (
    select 1 from public.user_memberships m
    join public.membership_plans p on p.id = m.plan_id
    where m.user_id = v_user and m.sessions_remaining > 0 and m.expires_at > now()
      and not m.frozen
      and p.location_id = v_session.location_id
  ) into v_has_mem;

  if not v_has_mem then
    select count(*) into v_open
    from public.bookings b
    join public.sessions s on s.id = b.session_id
    where b.user_id = v_user
      and b.status in ('pending','booked')
      and s.starts_at > now();
    if v_open >= 3 then
      raise exception 'TOO_MANY_OPEN';
    end if;
  end if;

  update public.sessions set booked_count = booked_count + 1 where id = p_session_id;

  insert into public.bookings (session_id, user_id, child_id, status)
  values (p_session_id, v_user, p_child_id, 'booked')
  returning id into v_booking;

  return v_booking;
end;
$$;

-- The tablet reaches this only through the service role, after the API route has
-- validated the device token. Never expose it to the browser.
revoke all on function public.kiosk_scan(text, uuid, text)                        from public, anon, authenticated;
revoke all on function public._kiosk_log(uuid, uuid, uuid, uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.kiosk_scan(text, uuid, text) to service_role;
-- gen_qr_token stays executable: it backs the profiles.qr_uuid column default,
-- which is evaluated as whichever role performs the insert.
