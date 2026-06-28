-- ============================================================================
-- Dellys — audit fixes (DB-level)
--   1. check_in_booking: enforce that a deducted membership's audience matches
--      the class audience (an adult bundle must not pay for a child class).
--   2. generate_sessions: use Europe/Chisinau (the app's TIMEZONE) instead of
--      the hardcoded Europe/Bucharest, so generated and displayed wall times
--      can never diverge if DST policy ever differs.
-- Idempotent (create or replace). Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. check_in_booking — adds the audience guard (MEMBERSHIP_WRONG_AUDIENCE).
-- ---------------------------------------------------------------------------
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
    if v_mem.expires_at <= now() then
      raise exception 'MEMBERSHIP_EXPIRED';
    end if;
    if v_mem.sessions_remaining <= 0 then
      raise exception 'MEMBERSHIP_EMPTY';
    end if;

    -- Audience must match the class: an adult bundle can't pay for a child
    -- class (and vice-versa).
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

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. generate_sessions — timezone aligned to the app (Europe/Chisinau).
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
    (class_type_id, template_id, starts_at, duration_min, capacity, instructor)
  select
    t.class_type_id,
    t.id,
    (gs.d::date + t.start_time::time) at time zone 'Europe/Chisinau',
    t.duration_min,
    t.capacity,
    t.instructor
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
