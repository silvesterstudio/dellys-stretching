-- Dellys — the front door, corrected on three counts.
--
-- 1. NO MORE FREE SESSION AT THE DOOR.
--    "Prima ședință gratuită" was removed from the site in Aug 2026, but
--    kiosk_scan still admitted anyone without a membership free of charge, once
--    per category — and there are three categories, so up to three free
--    sessions per account. The offer is withdrawn; the door now says so.
--    free_trial_usage rows are still written (first attendance in a category is
--    worth knowing, and nothing is lost if the offer is ever reinstated) — they
--    simply no longer buy entry.
--
-- 2. CHILDREN ARE NAMED.
--    Kids have no account and no QR: a parent scans for them. The screen showed
--    the PARENT's name, so staff could not tell which child was admitted, and a
--    parent with two children booked had to scan twice with nothing on screen
--    saying so — scan once, walk in, and the second child was silently never
--    marked present. kiosk_scan now returns the child's name, the parent's name
--    beside it, and how many of that parent's children in this class still need
--    scanning. A walk-in child is attributed when the parent has exactly one
--    child; with several there is no way to know which one turned up, so it
--    stays unattributed rather than guessing wrong.
--
-- 3. ONE ROUND TRIP.
--    kiosk_scan_by_token resolves the tablet, stamps its heartbeat and runs the
--    scan in a single call, so the API stops making three sequential trips to
--    the database for every person walking through the door.

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
  v_left     int;
  v_now      timestamptz := now();
  v_child_id uuid;
  v_child    text;
  v_kids     int;
  v_also     int := 0;
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
  -- A parent with two children booked has two rows here; each scan takes the
  -- next one still outstanding, which is what lets one QR admit both.
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
    v_child_id := v_booking.child_id;
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
    -- still has a seat AND that this member holds a usable bundle for. There is
    -- no free-session fallback any more — see the header.
    v_walkin := true;
    select s.* into v_session
      from public.sessions s
      join public.class_types ct on ct.id = s.class_type_id
     where s.location_id = p_location
       and s.status = 'scheduled'
       and s.booked_count < s.capacity
       and s.starts_at between v_now - interval '20 minutes'
                           and v_now + interval '45 minutes'
       and exists (
         select 1 from public.user_memberships m
           join public.membership_plans p on p.id = m.plan_id
          where m.user_id = v_user.id
            and not m.frozen
            and m.expires_at > v_now
            and m.sessions_remaining > 0
            and p.audience = ct.audience
            and p.location_id = p_location
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

  -- A walk-in into a kids class belongs to a child, but the QR belongs to the
  -- parent. Attribute it only when there is no ambiguity; guessing between
  -- siblings would put the wrong name on the wrong attendance record.
  if v_walkin and v_ct.audience = 'child' then
    select count(*) into v_kids from public.children where parent_id = v_user.id;
    if v_kids = 1 then
      select id into v_child_id from public.children where parent_id = v_user.id;
    end if;
  end if;

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

  -- No bundle, no entry. The front desk can still admit someone by hand
  -- (check_in_booking) when they judge it right — that discretion stays with a
  -- person, not with the door.
  if v_mem_id is null then
    return public._kiosk_log(v_user.id, v_booking.id, v_session.id, p_location, null, p_device, 'no_membership',
      jsonb_build_object('ok', false, 'code', 'no_membership',
                         'clientName', v_user.full_name));
  end if;

  -- 5. Seat the walk-in ------------------------------------------------------
  if v_walkin then
    insert into public.bookings (session_id, user_id, child_id, status, membership_id)
    values (v_session.id, v_user.id, v_child_id, 'booked', v_mem_id)
    returning * into v_booking;

    update public.sessions
       set booked_count = booked_count + 1
     where id = v_session.id;
  end if;

  -- 6. Attend ----------------------------------------------------------------
  update public.user_memberships
     set sessions_remaining = sessions_remaining - 1
   where id = v_mem_id
   returning sessions_remaining into v_left;

  update public.bookings
     set status = 'attended', membership_id = v_mem_id
   where id = v_booking.id;

  -- Still recorded: first attendance in a category is worth knowing, and the
  -- history survives if the free-session offer ever returns. It no longer
  -- grants entry.
  insert into public.free_trial_usage (user_id, category)
  values (v_user.id, v_ct.category)
  on conflict (user_id, category) do nothing;

  -- Who walked in, and is anyone still waiting on this QR?
  if v_child_id is not null then
    select name into v_child from public.children where id = v_child_id;
  end if;

  select count(*) into v_also
    from public.bookings b
   where b.user_id = v_user.id
     and b.session_id = v_session.id
     and b.status in ('booked', 'pending');

  return public._kiosk_log(v_user.id, v_booking.id, v_session.id, p_location, v_mem_id, p_device, 'ok',
    jsonb_build_object(
      'ok',                true,
      'code',              'ok',
      -- The person entering: the child when this seat is a child's, else the member.
      'clientName',        coalesce(v_child, v_user.full_name),
      -- Set only when the above is a child, so the tablet can show whose.
      'parentName',        case when v_child is not null then v_user.full_name else null end,
      -- More of this parent's children still booked into this class.
      'alsoBooked',        v_also,
      'className_ro',      v_ct.name_ro,
      'className_ru',      v_ct.name_ru,
      'color',             v_ct.color,
      'startsAt',          v_session.starts_at,
      'walkIn',            v_walkin,
      'freeTrial',         false,
      'sessionsRemaining', v_left
    ));
end;
$$;

-- ---------------------------------------------------------------------------
-- kiosk_scan_by_token — the whole door in one call
-- ---------------------------------------------------------------------------
-- The API used to make three sequential trips per scan: look the tablet up, run
-- the scan, stamp the heartbeat. All three happen here now, inside one round
-- trip — latency a person is standing at a door waiting through.
create or replace function public.kiosk_scan_by_token(
  p_qr           text,
  p_device_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.kiosk_devices%rowtype;
begin
  select * into v_device from public.kiosk_devices where token = p_device_token;
  -- An unknown or retired tablet gets nothing: this is the only thing between a
  -- leaked kiosk URL and free check-ins, so it is settled before the member is
  -- so much as looked up.
  if not found or not v_device.active then
    return jsonb_build_object('ok', false, 'code', 'device_unknown');
  end if;

  update public.kiosk_devices set last_seen_at = now() where id = v_device.id;

  return public.kiosk_scan(p_qr, v_device.location_id, v_device.id::text);
end;
$$;

-- Same posture as kiosk_scan: the service role only. A tablet holds a device
-- token, never a database credential.
revoke all on function public.kiosk_scan_by_token(text, text) from public, anon, authenticated;
grant execute on function public.kiosk_scan_by_token(text, text) to service_role;
