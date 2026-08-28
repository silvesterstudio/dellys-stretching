-- Dellys — a membership can now have a START DATE, and one that has not started
-- yet does not pay for anything.
--
-- Reception sells an abonament today that runs from the 1st of next month. Until
-- now there was nowhere to put that: the transfer form asked for a start date
-- and then wrote it into a free-text note, where nothing enforced it, so the
-- member could walk in and spend sessions immediately.
--
-- starts_at defaults to now() and is backfilled from created_at, so every
-- membership that already exists behaves exactly as it did before this ran.
--
-- The nine predicates below are the complete set that decide whether a bundle
-- can pay for a class. They were transformed from the definitions live in the
-- database at the time of writing, rather than retyped, so they cannot have
-- drifted from what was actually deployed:
--
--   kiosk_scan             3   (walk-in probe, wrong-audience probe, payment)
--   kiosk_options          2   (any-usable probe, per-class payable probe)
--   kiosk_check_in_choice  2   (payment, any-usable probe)
--   book_session           1   (does a bundle lift the no-membership cap)
--   check_in_booking       1   (front-desk check-in -> MEMBERSHIP_NOT_STARTED)
--
-- Miss one and a future-dated membership silently pays somewhere.

alter table public.user_memberships
  add column if not exists starts_at timestamptz not null default now();

-- Everything sold before today started the day it was sold.
update public.user_memberships set starts_at = created_at where starts_at > created_at;

comment on column public.user_memberships.starts_at is
  'When this membership becomes usable. Defaults to the moment it was sold; the front desk can set it forward for a bundle that begins later.';

-- kiosk_scan: 3 predicate(s) now also require the membership to have STARTED.
CREATE OR REPLACE FUNCTION public.kiosk_scan(p_qr text, p_location uuid, p_device text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
       and m.starts_at <= v_now
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
            and m.starts_at <= v_now
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
     and m.starts_at <= v_now
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
$function$
;

-- kiosk_options: 2 predicate(s) now also require the membership to have STARTED.
CREATE OR REPLACE FUNCTION public.kiosk_options(p_qr text, p_device_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_device  public.kiosk_devices%rowtype;
  v_user    public.profiles%rowtype;
  v_now     timestamptz := now();
  v_from    timestamptz;
  v_to      timestamptz;
  v_loc     uuid;
  v_dev     text;
  v_home    text;
  v_opts    jsonb := '[]'::jsonb;
  v_usable  boolean;
  v_payable boolean;
  v_near    public.class_types%rowtype;
  s         record;
  ct        public.class_types%rowtype;
  b         record;
  kid       record;
begin
  -- The tablet first: an unknown or retired token is the only thing between a
  -- leaked kiosk URL and free check-ins, so it is settled before anything else.
  select * into v_device from public.kiosk_devices where token = p_device_token;
  if not found or not v_device.active then
    return jsonb_build_object('ok', false, 'code', 'device_unknown');
  end if;
  update public.kiosk_devices set last_seen_at = v_now where id = v_device.id;
  v_loc := v_device.location_id;
  v_dev := v_device.id::text;

  select * into v_user from public.profiles where qr_uuid = p_qr;
  if not found then
    return public._kiosk_log(null, null, null, v_loc, null, v_dev, 'not_found',
      jsonb_build_object('ok', false, 'code', 'not_found'));
  end if;

  if v_user.location_id is not null and v_user.location_id <> v_loc then
    select name into v_home from public.locations where id = v_user.location_id;
    return public._kiosk_log(v_user.id, null, null, v_loc, null, v_dev, 'wrong_location',
      jsonb_build_object('ok', false, 'code', 'wrong_location',
                         'clientName', v_user.full_name, 'homeLocation', v_home));
  end if;

  v_from := v_now - interval '30 minutes';
  v_to   := v_now + interval '90 minutes';

  -- Does this member hold anything usable here at all, of any audience? Used
  -- below to tell "you have nothing" apart from "you have the wrong kind".
  select exists (
    select 1 from public.user_memberships m
      join public.membership_plans p on p.id = m.plan_id
     where m.user_id = v_user.id
       and not m.frozen
       and m.expires_at > v_now
       and m.starts_at <= v_now
       and m.sessions_remaining > 0
       and p.location_id = v_loc
  ) into v_usable;

  for s in
    select * from public.sessions
     where location_id = v_loc
       and status = 'scheduled'
       and starts_at between v_from and v_to
     order by starts_at
  loop
    select * into ct from public.class_types where id = s.class_type_id;

    select exists (
      select 1 from public.user_memberships m
        join public.membership_plans p on p.id = m.plan_id
       where m.user_id = v_user.id
         and not m.frozen
         and m.expires_at > v_now
         and m.starts_at <= v_now
         and m.sessions_remaining > 0
         and p.audience = ct.audience
         and p.location_id = v_loc
    ) into v_payable;

    -- Seats already reserved on this QR. One row per person — a parent with two
    -- children booked into the same class gets two entries, which is what makes
    -- "which child?" answerable on the screen instead of by scanning twice.
    for b in
      select bk.id, bk.child_id, c.name as child_name
        from public.bookings bk
        left join public.children c on c.id = bk.child_id
       where bk.user_id = v_user.id
         and bk.session_id = s.id
         and bk.status in ('booked', 'pending')
       order by c.name nulls first
    loop
      v_opts := v_opts || jsonb_build_object(
        'sessionId',    s.id,
        'childId',      b.child_id,
        'personName',   coalesce(b.child_name, v_user.full_name),
        'className_ro', ct.name_ro,
        'className_ru', ct.name_ru,
        'color',        ct.color,
        'startsAt',     s.starts_at,
        'reserved',     true,
        'payable',      v_payable
      );
    end loop;

    -- Walk-in possibilities: only where there is a seat and a bundle that can
    -- pay for it. An unpayable class is left off the list entirely rather than
    -- shown and refused on tap.
    if s.booked_count < s.capacity and v_payable then
      if ct.audience = 'child' then
        -- One entry per child who is not already on this class.
        for kid in
          select c.id, c.name from public.children c
           where c.parent_id = v_user.id
             and not exists (
               select 1 from public.bookings bk
                where bk.session_id = s.id
                  and bk.user_id = v_user.id
                  and bk.child_id = c.id
                  and bk.status in ('booked', 'pending', 'attended')
             )
           order by c.name
        loop
          v_opts := v_opts || jsonb_build_object(
            'sessionId',    s.id,
            'childId',      kid.id,
            'personName',   kid.name,
            'className_ro', ct.name_ro,
            'className_ru', ct.name_ru,
            'color',        ct.color,
            'startsAt',     s.starts_at,
            'reserved',     false,
            'payable',      true
          );
        end loop;
      elsif not exists (
        select 1 from public.bookings bk
         where bk.session_id = s.id
           and bk.user_id = v_user.id
           and bk.child_id is null
           and bk.status in ('booked', 'pending', 'attended')
      ) then
        v_opts := v_opts || jsonb_build_object(
          'sessionId',    s.id,
          'childId',      null,
          'personName',   v_user.full_name,
          'className_ro', ct.name_ro,
          'className_ru', ct.name_ru,
          'color',        ct.color,
          'startsAt',     s.starts_at,
          'reserved',     false,
          'payable',      true
        );
      end if;
    end if;
  end loop;

  if jsonb_array_length(v_opts) > 0 then
    return public._kiosk_log(v_user.id, null, null, v_loc, null, v_dev, 'options',
      jsonb_build_object('ok', true, 'code', 'options',
                         'clientName', v_user.full_name,
                         'options', v_opts));
  end if;

  -- Nothing to offer. Say WHY, in the order the member can act on it — the same
  -- ladder kiosk_scan uses, so the two paths never disagree.
  if not exists (
    select 1 from public.sessions
     where location_id = v_loc and status = 'scheduled'
       and starts_at between v_from and v_to
  ) then
    return public._kiosk_log(v_user.id, null, null, v_loc, null, v_dev, 'no_class',
      jsonb_build_object('ok', false, 'code', 'no_class', 'clientName', v_user.full_name));
  end if;

  if exists (
    select 1 from public.bookings bk
      join public.sessions s2 on s2.id = bk.session_id
     where bk.user_id = v_user.id
       and s2.location_id = v_loc
       and bk.status = 'attended'
       and s2.starts_at between v_from and v_to
  ) then
    return public._kiosk_log(v_user.id, null, null, v_loc, null, v_dev, 'already_checked_in',
      jsonb_build_object('ok', false, 'code', 'already_checked_in', 'clientName', v_user.full_name));
  end if;

  if not exists (
    select 1 from public.sessions
     where location_id = v_loc and status = 'scheduled'
       and booked_count < capacity
       and starts_at between v_from and v_to
  ) then
    return public._kiosk_log(v_user.id, null, null, v_loc, null, v_dev, 'class_full',
      jsonb_build_object('ok', false, 'code', 'class_full', 'clientName', v_user.full_name));
  end if;

  if v_usable then
    select ct2.* into v_near
      from public.sessions s2
      join public.class_types ct2 on ct2.id = s2.class_type_id
     where s2.location_id = v_loc and s2.status = 'scheduled'
       and s2.booked_count < s2.capacity
       and s2.starts_at between v_from and v_to
     order by abs(extract(epoch from (s2.starts_at - v_now)))
     limit 1;
    return public._kiosk_log(v_user.id, null, null, v_loc, null, v_dev, 'wrong_audience',
      jsonb_build_object('ok', false, 'code', 'wrong_audience',
                         'clientName', v_user.full_name,
                         'className_ro', v_near.name_ro,
                         'className_ru', v_near.name_ru));
  end if;

  return public._kiosk_log(v_user.id, null, null, v_loc, null, v_dev, 'no_membership',
    jsonb_build_object('ok', false, 'code', 'no_membership', 'clientName', v_user.full_name));
end;
$function$
;

-- kiosk_check_in_choice: 2 predicate(s) now also require the membership to have STARTED.
CREATE OR REPLACE FUNCTION public.kiosk_check_in_choice(p_qr text, p_device_token text, p_session uuid, p_child uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_device  public.kiosk_devices%rowtype;
  v_user    public.profiles%rowtype;
  v_session public.sessions%rowtype;
  v_ct      public.class_types%rowtype;
  v_booking public.bookings%rowtype;
  v_mem_id  uuid;
  v_left    int;
  v_also    int := 0;
  v_child   text;
  v_home    text;
  v_usable  boolean;
  v_walkin  boolean := false;
  v_now     timestamptz := now();
  v_loc     uuid;
  v_dev     text;
begin
  select * into v_device from public.kiosk_devices where token = p_device_token;
  if not found or not v_device.active then
    return jsonb_build_object('ok', false, 'code', 'device_unknown');
  end if;
  v_loc := v_device.location_id;
  v_dev := v_device.id::text;

  select * into v_user from public.profiles where qr_uuid = p_qr;
  if not found then
    return public._kiosk_log(null, null, null, v_loc, null, v_dev, 'not_found',
      jsonb_build_object('ok', false, 'code', 'not_found'));
  end if;

  if v_user.location_id is not null and v_user.location_id <> v_loc then
    select name into v_home from public.locations where id = v_user.location_id;
    return public._kiosk_log(v_user.id, null, null, v_loc, null, v_dev, 'wrong_location',
      jsonb_build_object('ok', false, 'code', 'wrong_location',
                         'clientName', v_user.full_name, 'homeLocation', v_home));
  end if;

  -- The class, locked: capacity is decided under this lock, so two tablets
  -- cannot both take the last seat.
  select * into v_session from public.sessions where id = p_session for update;
  if not found
     or v_session.location_id <> v_loc
     or v_session.status <> 'scheduled'
     or v_session.starts_at not between v_now - interval '30 minutes'
                                    and v_now + interval '90 minutes' then
    return public._kiosk_log(v_user.id, null, p_session, v_loc, null, v_dev, 'no_class',
      jsonb_build_object('ok', false, 'code', 'no_class', 'clientName', v_user.full_name));
  end if;

  -- A child may only be checked in by their own parent.
  if p_child is not null and not exists (
    select 1 from public.children where id = p_child and parent_id = v_user.id
  ) then
    return public._kiosk_log(v_user.id, null, v_session.id, v_loc, null, v_dev, 'not_found',
      jsonb_build_object('ok', false, 'code', 'not_found'));
  end if;

  select * into v_ct from public.class_types where id = v_session.class_type_id;

  -- Already through the door for this exact seat?
  if exists (
    select 1 from public.bookings
     where session_id = v_session.id
       and user_id = v_user.id
       and coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = coalesce(p_child, '00000000-0000-0000-0000-000000000000'::uuid)
       and status = 'attended'
  ) then
    return public._kiosk_log(v_user.id, null, v_session.id, v_loc, null, v_dev, 'already_checked_in',
      jsonb_build_object('ok', false, 'code', 'already_checked_in',
                         'clientName', v_user.full_name));
  end if;

  -- Pay for it. Soonest-expiring usable bundle first so nothing is wasted,
  -- locked so the front desk cannot spend the same session at the same moment.
  select m.id into v_mem_id
    from public.user_memberships m
    join public.membership_plans p on p.id = m.plan_id
   where m.user_id = v_user.id
     and not m.frozen
     and m.expires_at > v_now
     and m.starts_at <= v_now
     and m.sessions_remaining > 0
     and p.audience = v_ct.audience
     and p.location_id = v_loc
   order by m.expires_at asc
   limit 1
   for update of m;

  if v_mem_id is null then
    select exists (
      select 1 from public.user_memberships m
        join public.membership_plans p on p.id = m.plan_id
       where m.user_id = v_user.id and not m.frozen
         and m.expires_at > v_now and m.starts_at <= v_now and m.sessions_remaining > 0
         and p.location_id = v_loc
    ) into v_usable;
    if v_usable then
      return public._kiosk_log(v_user.id, null, v_session.id, v_loc, null, v_dev, 'wrong_audience',
        jsonb_build_object('ok', false, 'code', 'wrong_audience',
                           'clientName', v_user.full_name,
                           'className_ro', v_ct.name_ro,
                           'className_ru', v_ct.name_ru));
    end if;
    return public._kiosk_log(v_user.id, null, v_session.id, v_loc, null, v_dev, 'no_membership',
      jsonb_build_object('ok', false, 'code', 'no_membership', 'clientName', v_user.full_name));
  end if;

  -- Their reserved seat, if they had one.
  select * into v_booking
    from public.bookings
   where session_id = v_session.id
     and user_id = v_user.id
     and coalesce(child_id, '00000000-0000-0000-0000-000000000000'::uuid)
       = coalesce(p_child, '00000000-0000-0000-0000-000000000000'::uuid)
     and status in ('booked', 'pending')
   limit 1;

  if not found then
    -- Walking in. Capacity is re-checked here, under the lock taken above.
    if v_session.booked_count >= v_session.capacity then
      return public._kiosk_log(v_user.id, null, v_session.id, v_loc, null, v_dev, 'class_full',
        jsonb_build_object('ok', false, 'code', 'class_full', 'clientName', v_user.full_name));
    end if;
    v_walkin := true;
    insert into public.bookings (session_id, user_id, child_id, status, membership_id)
    values (v_session.id, v_user.id, p_child, 'booked', v_mem_id)
    returning * into v_booking;
    update public.sessions set booked_count = booked_count + 1 where id = v_session.id;
  end if;

  update public.user_memberships
     set sessions_remaining = sessions_remaining - 1
   where id = v_mem_id
   returning sessions_remaining into v_left;

  update public.bookings
     set status = 'attended', membership_id = v_mem_id
   where id = v_booking.id;

  insert into public.free_trial_usage (user_id, category)
  values (v_user.id, v_ct.category)
  on conflict (user_id, category) do nothing;

  if p_child is not null then
    select name into v_child from public.children where id = p_child;
  end if;

  select count(*) into v_also
    from public.bookings
   where user_id = v_user.id
     and session_id = v_session.id
     and status in ('booked', 'pending');

  return public._kiosk_log(v_user.id, v_booking.id, v_session.id, v_loc, v_mem_id, v_dev, 'ok',
    jsonb_build_object(
      'ok',                true,
      'code',              'ok',
      'clientName',        coalesce(v_child, v_user.full_name),
      'parentName',        case when v_child is not null then v_user.full_name else null end,
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
$function$
;

-- book_session: 1 predicate(s) now also require the membership to have STARTED.
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

-- check_in_booking: 1 predicate(s) now also require the membership to have STARTED.
CREATE OR REPLACE FUNCTION public.check_in_booking(p_booking_id uuid, p_membership_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_booking  public.bookings%rowtype;
  v_mem      public.user_memberships%rowtype;
  v_sess_aud text;
  v_plan_aud text;
begin
  if not public.is_staff() then
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
    if v_mem.starts_at > now() then
      raise exception 'MEMBERSHIP_NOT_STARTED';
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

  -- First attendance in a category consumes that category's free trial.
  insert into public.free_trial_usage (user_id, category)
  select v_booking.user_id, ct.category
    from public.sessions s
    join public.class_types ct on ct.id = s.class_type_id
   where s.id = v_booking.session_id and ct.category is not null
  on conflict (user_id, category) do nothing;

  return true;
end;
$function$
;
