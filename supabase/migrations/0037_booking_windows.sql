-- 0037 — booking and cancellation windows
--
-- The studio decides whether a class runs from how many people are on the list,
-- and it has to decide before the trainer travels: a booking that lands ten
-- minutes before the hour is worth nothing to that decision, and a cancellation
-- that lands at the same moment can drop a class under five people with nobody
-- left to tell. So online self-service now has two edges:
--
--   * book    — must be at least 3 hours before the class starts
--   * cancel  — must be at least 5 hours before the class starts
--
-- Both are enforced HERE, not in the browser, because the RPCs are what the
-- anon key can reach. The UI shows the same two rules and closes its buttons at
-- the same moments, but that is a courtesy, not the gate.
--
-- Deliberately NOT affected:
--   * the front desk — admin/reception add and remove people through the
--     service role (admin/actions.ts), never through these functions, so a
--     walk-in at the door is still possible at any hour;
--   * the kiosk — check-in is its own path (kiosk_check_in_choice). Somebody
--     who missed the 3-hour window can still turn up and be admitted as a
--     walk-in if there is room;
--   * cancel_booking called by STAFF, which stays open so reception can free a
--     seat when a member phones in.
--
-- Both functions are re-declared in full (Postgres has no way to patch a body).
-- book_session is 0036's live definition plus one guard; cancel_booking is
-- 0002's plus one guard. Nothing else in either body changed.

-- ---------------------------------------------------------------------------
-- book_session — + BOOKING_CLOSED inside the 3-hour window.
-- ---------------------------------------------------------------------------
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
  -- Online booking closes 3h before the class. Kept as its own code (not
  -- PAST_SESSION) so the screen can say WHY and offer the desk instead.
  if v_session.starts_at <= now() + interval '3 hours' then
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

-- ---------------------------------------------------------------------------
-- cancel_booking — + CANCEL_CLOSED inside the 5-hour window, staff exempt.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_booking(p_booking_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_user    uuid := auth.uid();
  v_booking public.bookings%rowtype;
  v_session public.sessions%rowtype;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then
    raise exception 'NOT_FOUND';
  end if;
  if v_booking.user_id <> v_user and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  if v_booking.status not in ('pending','booked') then
    raise exception 'NOT_CANCELLABLE';
  end if;

  -- Lock the session to safely decrement.
  select * into v_session from public.sessions where id = v_booking.session_id for update;
  if v_session.starts_at <= now() then
    raise exception 'PAST_SESSION';
  end if;
  -- Self-service cancelling closes 5h before the class. The front desk is
  -- exempt: somebody who phones in must still be removable from the list, and
  -- that is a decision a person makes, not the website.
  if not public.is_staff() and v_session.starts_at <= now() + interval '5 hours' then
    raise exception 'CANCEL_CLOSED';
  end if;

  update public.bookings set status = 'cancelled' where id = p_booking_id;
  update public.sessions
    set booked_count = greatest(0, booked_count - 1)
    where id = v_booking.session_id;

  return true;
end;
$function$
;
