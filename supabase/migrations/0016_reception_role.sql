-- ============================================================================
-- Dellys — reception (front-desk) role (Bundle D)
--   A limited staff role that can run check-in but NOT pricing/resets/deletes.
--   is_admin() is unchanged (admin-only), so every admin-gated RLS policy and
--   destructive action stays admin-only. is_staff() = admin OR reception, and
--   only the check-in RPC is widened to it. All reception-reachable reads/writes
--   in the app go through the service role after a requireStaff() gate, so no
--   table RLS policy is loosened here.
-- ============================================================================

-- 1. Allow the new role value.
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('client','admin','reception'));

-- 2. is_staff(): admin or reception.
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin','reception')
  );
$$;
grant execute on function public.is_staff() to authenticated, anon;

-- 3. Widen ONLY the check-in RPC from is_admin() to is_staff() (verbatim body
--    from the live definition, single line changed).
create or replace function public.check_in_booking(p_booking_id uuid, p_membership_id uuid default null::uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
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
$function$;
