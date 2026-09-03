-- 0038 — the booking window narrows from 3 hours to 2
--
-- Owner's call: 3 hours out was turning away people who decide to train the
-- same evening, and the headcount decision can live with two.
--
-- Cancelling is UNCHANGED at 5 hours (0037). That widens the gap the owner was
-- shown and accepted: anything booked less than 5 hours out can never be
-- cancelled online, only by ringing the desk. The confirm screen and the guest
-- pop-up both state the two hours before anybody commits.
--
-- book_session is 0037's definition with one number changed. Nothing else in
-- the body differs; cancel_booking is not touched.

CREATE OR REPLACE FUNCTION public.book_session(p_session_id uuid, p_child_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  -- Online booking closes 2h before the class. Kept as its own code (not
  -- PAST_SESSION) so the screen can say WHY and offer the desk instead.
  if v_session.starts_at <= now() + interval '2 hours' then
    raise exception 'BOOKING_CLOSED';
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
    where m.user_id = v_user and m.sessions_remaining > 0 and m.expires_at > now() and m.starts_at <= now()
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
$function$
;
