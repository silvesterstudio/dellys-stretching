-- ============================================================================
-- Dellys — Fit Ball class, kids age-group classes/plans, and a real free trial
--   1. fit_ball (adult) class type.
--   2. Kids split into two age groups (3-7, 8-13) — separate classes + plans;
--      the generic "gimnastica" class is retired (deactivated, history kept).
--   3. profiles.free_session_used — one truly free session per person, ever.
--      check_in_booking consumes it on the first no-membership attendance.
-- Idempotent. Safe to re-run.
-- ============================================================================

-- 1 + 2a. New class types --------------------------------------------------
insert into public.class_types (key, audience, name_ro, name_ru, color, default_capacity)
values
  ('fit_ball',        'adult', 'Fit Ball',            'Фитбол',              '#d42f6b', 11),
  ('gimnastica_3_7',  'child', 'Gimnastică 3-7 ani',  'Гимнастика 3-7 лет',  '#8b69a1', 11),
  ('gimnastica_8_13', 'child', 'Gimnastică 8-13 ani', 'Гимнастика 8-13 лет', '#a589b9', 11)
on conflict (key) do nothing;

-- Retire the generic kids class in favour of the two age groups. Deactivating
-- (not deleting) keeps any historical sessions intact (FK is RESTRICT).
update public.class_types set active = false where key = 'gimnastica';

-- 2b. Kids age-group plans (12 sessions / 30 days) -------------------------
insert into public.membership_plans
  (audience, name_ro, name_ru, session_count, price, currency, validity_days, sort_order, active)
values
  ('child', 'Gimnastică 3-7 ani · 12 ședințe',  'Гимнастика 3-7 лет · 12 занятий',  12, 550, 'MDL', 30, 5, true),
  ('child', 'Gimnastică 8-13 ani · 12 ședințe', 'Гимнастика 8-13 лет · 12 занятий', 12, 600, 'MDL', 30, 6, true)
on conflict (audience, name_ro) do update set
  name_ru       = excluded.name_ru,
  session_count = excluded.session_count,
  price         = excluded.price,
  validity_days = excluded.validity_days,
  sort_order    = excluded.sort_order,
  active        = true;

-- 3. Free trial ------------------------------------------------------------
alter table public.profiles
  add column if not exists free_session_used boolean not null default false;

-- check_in_booking — same as 0008, plus: attending WITHOUT a membership
-- consumes the client's one free trial (so only the first such session is ever
-- free; the rest are "pay at reception").
create or replace function public.check_in_booking(
  p_booking_id   uuid,
  p_membership_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking  public.bookings%rowtype;
  v_mem      public.user_memberships%rowtype;
  v_sess_aud text;
  v_plan_aud text;
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_booking.status not in ('booked','pending','no_show') then
    raise exception 'NOT_CHECKINABLE';
  end if;

  if p_membership_id is not null then
    select * into v_mem from public.user_memberships
      where id = p_membership_id for update;
    if not found then
      raise exception 'MEMBERSHIP_NOT_FOUND';
    end if;
    if v_mem.user_id <> v_booking.user_id then
      raise exception 'MEMBERSHIP_WRONG_USER';
    end if;
    if v_mem.frozen then
      raise exception 'MEMBERSHIP_FROZEN';
    end if;
    if v_mem.expires_at <= now() then
      raise exception 'MEMBERSHIP_EXPIRED';
    end if;
    if v_mem.sessions_remaining <= 0 then
      raise exception 'MEMBERSHIP_EMPTY';
    end if;

    select ct.audience into v_sess_aud
      from public.sessions s
      join public.class_types ct on ct.id = s.class_type_id
      where s.id = v_booking.session_id;
    select audience into v_plan_aud
      from public.membership_plans where id = v_mem.plan_id;
    if v_sess_aud is distinct from v_plan_aud then
      raise exception 'MEMBERSHIP_WRONG_AUDIENCE';
    end if;

    update public.user_memberships
      set sessions_remaining = sessions_remaining - 1
      where id = p_membership_id;
  end if;

  update public.bookings
    set status = 'attended', membership_id = p_membership_id
    where id = p_booking_id;

  -- No membership used → this is the client's free / pay-at-reception session.
  -- Consume their single free trial so future no-membership sessions aren't free.
  if p_membership_id is null then
    update public.profiles
      set free_session_used = true
      where id = v_booking.user_id and free_session_used = false;
  end if;

  return true;
end;
$$;
