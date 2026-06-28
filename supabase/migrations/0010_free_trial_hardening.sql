-- ============================================================================
-- Dellys — harden the one-free-session trial against abuse
--   1. guard_profile_role -> also protect free_session_used: an authenticated
--      non-admin can no longer flip their own trial flag (or role) via the API.
--      Legit name/phone self-edits still work (those columns are untouched).
--   2. check_in_booking -> the free trial is consumed by the FIRST attendance of
--      ANY kind (membership or not), so a lapsed-membership client can't claim a
--      brand-new "free" session each time their membership expires.
-- Idempotent. Safe to re-run.
-- ============================================================================

-- 1. Guard privileged profile columns for authenticated non-admins. ----------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role / direct SQL (no JWT, auth.uid() null) and admins may change
  -- anything. Authenticated non-admins keep the privileged columns frozen to
  -- their previous values — silently, so a normal name/phone update still saves.
  if auth.uid() is not null and not exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ) then
    new.role := old.role;
    new.free_session_used := old.free_session_used;
  end if;
  return new;
end;
$$;

-- 2. Consume the free trial on the first attendance of any kind. -------------
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

  -- First attendance of ANY kind consumes the one-time free trial.
  update public.profiles
    set free_session_used = true
    where id = v_booking.user_id and free_session_used = false;

  return true;
end;
$$;
