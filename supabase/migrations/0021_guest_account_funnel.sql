-- Dellys — 0021 guest→account→membership funnel
--
-- Turns the no-login guest booking into a measurable acquisition pipeline:
--   1. guest_bookings.claimed_by links a booking to the account made from it.
--   2. guest_bookings.category snapshots the trial category so a guest's first
--      session can be "remembered" as their used free trial once they have an account.
--   3. link_guest_bookings(user, phone): matches prior guest bookings by phone,
--      attaches them to the account, and records the free-trial usage. Called from
--      handle_new_user (self-serve signup) and the front-desk convert action.
--   4. guest_funnel_stats(): guests → accounts → memberships counts for the dashboard.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.guest_bookings
  add column if not exists claimed_by uuid references public.profiles(id) on delete set null,
  add column if not exists category   text;

create index if not exists guest_bookings_phone8_idx
  on public.guest_bookings ((right(regexp_replace(phone, '\D', '', 'g'), 8)));
create index if not exists guest_bookings_claimed_idx
  on public.guest_bookings (claimed_by);

-- ---------------------------------------------------------------------------
-- 2. Link a user's prior guest bookings (by phone) + remember free sessions
-- ---------------------------------------------------------------------------
create or replace function public.link_guest_bookings(p_user uuid, p_phone text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  key8 text;
begin
  key8 := right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 8);
  if length(key8) < 6 then
    return 0;
  end if;

  update public.guest_bookings gb
     set claimed_by = p_user
   where gb.claimed_by is null
     and right(regexp_replace(gb.phone, '\D', '', 'g'), 8) = key8;
  get diagnostics n = row_count;

  -- Their guest session(s) count as the used free trial for that category.
  insert into public.free_trial_usage (user_id, category)
  select distinct p_user, gb.category
    from public.guest_bookings gb
   where gb.claimed_by = p_user and gb.category is not null
  on conflict (user_id, category) do nothing;

  return n;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Signup trigger now also auto-links matching guest bookings
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone, preferred_lang)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    coalesce(new.raw_user_meta_data->>'preferred_lang', 'ro')
  )
  on conflict (id) do nothing;

  -- Attribute prior no-login bookings (same phone) to this new account.
  perform public.link_guest_bookings(new.id, nullif(new.raw_user_meta_data->>'phone', ''));

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Funnel stats (admin dashboard) — service-role only
-- ---------------------------------------------------------------------------
create or replace function public.guest_funnel_stats()
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'guests', (
      select count(distinct right(regexp_replace(phone, '\D', '', 'g'), 8))
        from public.guest_bookings where status <> 'cancelled'
    ),
    'accounts', (
      select count(distinct claimed_by) from public.guest_bookings where claimed_by is not null
    ),
    'memberships', (
      select count(distinct gb.claimed_by)
        from public.guest_bookings gb
       where gb.claimed_by is not null
         and exists (select 1 from public.user_memberships um where um.user_id = gb.claimed_by)
    )
  );
$$;
revoke execute on function public.guest_funnel_stats() from anon, authenticated;
revoke execute on function public.link_guest_bookings(uuid, text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Backfill existing data
-- ---------------------------------------------------------------------------
-- Snapshot category from the still-linked session.
update public.guest_bookings gb
   set category = ct.category
  from public.sessions s
  join public.class_types ct on ct.id = s.class_type_id
 where gb.session_id = s.id and gb.category is null;

-- Link already-existing guest bookings to already-existing accounts by phone.
update public.guest_bookings gb
   set claimed_by = p.id
  from public.profiles p
 where gb.claimed_by is null
   and p.phone is not null
   and length(regexp_replace(p.phone, '\D', '', 'g')) >= 6
   and right(regexp_replace(gb.phone, '\D', '', 'g'), 8) = right(regexp_replace(p.phone, '\D', '', 'g'), 8);

-- Record their free-trial usage from those links.
insert into public.free_trial_usage (user_id, category)
select distinct gb.claimed_by, gb.category
  from public.guest_bookings gb
 where gb.claimed_by is not null and gb.category is not null
on conflict (user_id, category) do nothing;
