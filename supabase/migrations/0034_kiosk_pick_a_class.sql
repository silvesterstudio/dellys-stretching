-- Dellys — the member chooses, instead of the door guessing.
--
-- Until now a scan was one atomic decision: kiosk_scan looked for a reservation,
-- and failing that picked the nearest class it thought the member could pay for.
-- When that guess was wrong the member had no way to say so — and no way to see
-- what the tablet was even offering them. A member holding an adult bundle in
-- front of a children's class was simply refused.
--
-- The scan is now two steps:
--
--   kiosk_options()         who are you, and what could you check into right now
--   kiosk_check_in_choice() do this one, specifically
--
-- Nothing is written by the first step, so a member who walks away mid-list
-- leaves no trace: no seat held, no session spent.
--
-- WINDOW. Options span 30 minutes before a class to 90 minutes ahead — the span
-- someone could plausibly be arriving for. Deliberately not "the rest of today":
-- a list running to 20:00 lets someone at 09:00 tap the evening class and be
-- marked present, with a session deducted, for a class they have not attended.
--
-- The old kiosk_scan is left in place and untouched. It is what the front desk
-- and the regression suite drive, and it remains the fallback if the picker is
-- ever rolled back.

-- ---------------------------------------------------------------------------
-- kiosk_options — everything this QR could check into, right now
-- ---------------------------------------------------------------------------
create or replace function public.kiosk_options(
  p_qr           text,
  p_device_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
$$;

-- ---------------------------------------------------------------------------
-- kiosk_check_in_choice — do the one they tapped
-- ---------------------------------------------------------------------------
-- Every guard is re-applied here. The option list is a suggestion made a few
-- seconds ago by a tablet nobody trusts; the seat may have gone, the class may
-- have been cancelled, the bundle may have been spent at the front desk in the
-- meantime.
create or replace function public.kiosk_check_in_choice(
  p_qr           text,
  p_device_token text,
  p_session      uuid,
  p_child        uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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
         and m.expires_at > v_now and m.sessions_remaining > 0
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
$$;

-- Same posture as the rest of the door: the service role only. A tablet holds a
-- device token, never a database credential.
revoke all on function public.kiosk_options(text, text)                     from public, anon, authenticated;
revoke all on function public.kiosk_check_in_choice(text, text, uuid, uuid) from public, anon, authenticated;
grant execute on function public.kiosk_options(text, text)                     to service_role;
grant execute on function public.kiosk_check_in_choice(text, text, uuid, uuid) to service_role;
