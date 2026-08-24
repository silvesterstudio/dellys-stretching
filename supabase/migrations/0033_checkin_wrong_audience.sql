-- Dellys — tell someone with the wrong KIND of membership what is actually wrong.
--
-- Found on the tablet: a member holding a valid adult bundle scanned at Rîșcani
-- while the only class in the window was "Gimnastică 9-14 ani". An adult bundle
-- cannot pay for a children's class, so the door refused — correctly — but the
-- screen said "Fără abonament activ", which is simply untrue. He had one. It
-- just did not cover that class. That sends a paying member to the front desk
-- convinced the system has lost their membership.
--
-- no_membership now means what it says: nothing usable at all. When the member
-- does hold a usable bundle and only the audience is wrong, the door says so and
-- names the class that is running.

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
  v_other    public.class_types%rowtype;
  v_usable   boolean;
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

  -- Does this member hold ANY usable bundle here, of any audience? Asked once,
  -- used below to tell "you have nothing" apart from "you have the wrong kind".
  select exists (
    select 1 from public.user_memberships m
      join public.membership_plans p on p.id = m.plan_id
     where m.user_id = v_user.id
       and not m.frozen
       and m.expires_at > v_now
       and m.sessions_remaining > 0
       and p.location_id = p_location
  ) into v_usable;

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
    -- no free-session fallback (0032).
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
      -- no class at all, is it full, is it for other people, or can they simply
      -- not pay for it? Without this ladder a full class reports "no class now"
      -- and the member stands in front of one that is visibly running.
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

      -- A class is running with a free seat. If they hold a usable bundle, the
      -- only thing left is that it is for the other audience — an adult bundle
      -- in front of a children's class, or the reverse. Name the class so the
      -- member can see for themselves rather than being told, wrongly, that
      -- their membership does not exist.
      if v_usable then
        select ct.* into v_other
          from public.sessions s
          join public.class_types ct on ct.id = s.class_type_id
         where s.location_id = p_location
           and s.status = 'scheduled'
           and s.booked_count < s.capacity
           and s.starts_at between v_now - interval '20 minutes'
                               and v_now + interval '45 minutes'
         order by abs(extract(epoch from (s.starts_at - v_now)))
         limit 1;

        return public._kiosk_log(v_user.id, null, null, p_location, null, p_device, 'wrong_audience',
          jsonb_build_object('ok', false, 'code', 'wrong_audience',
                             'clientName', v_user.full_name,
                             'className_ro', v_other.name_ro,
                             'className_ru', v_other.name_ru));
      end if;

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

  -- No bundle for THIS class. Reached with a reservation in hand, so say which
  -- of the two problems it is. The front desk can still admit someone by hand
  -- (check_in_booking) when they judge it right — that discretion stays with a
  -- person, not with the door.
  if v_mem_id is null then
    if v_usable then
      return public._kiosk_log(v_user.id, v_booking.id, v_session.id, p_location, null, p_device, 'wrong_audience',
        jsonb_build_object('ok', false, 'code', 'wrong_audience',
                           'clientName', v_user.full_name,
                           'className_ro', v_ct.name_ro,
                           'className_ru', v_ct.name_ru));
    end if;
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
