-- ============================================================================
-- Dellys — one free introductory session PER membership category
--   Replaces the single global profiles.free_session_used boolean with a
--   per-category model: a client gets one free trial for each category
--   (adult, kids_3_7, kids_8_13). A category's trial is consumed on the first
--   attendance of a session in that category.
--
--   1. class_types.category — the trial/membership bucket a class belongs to.
--   2. free_trial_usage(user_id, category) — one row per consumed trial.
--   3. check_in_booking — record the category trial on attendance.
--   4. guard_profile_role — drop the now-removed free_session_used handling.
--   5. profiles.free_session_used — dropped.
-- Idempotent. Safe to re-run.
-- ============================================================================

-- 1. Category on class types -------------------------------------------------
alter table public.class_types add column if not exists category text;
update public.class_types set category = 'adult'     where audience = 'adult'  and category is null;
update public.class_types set category = 'kids_3_7'  where key = 'gimnastica_3_7';
update public.class_types set category = 'kids_8_13' where key = 'gimnastica_8_13';
update public.class_types set category = 'kids_3_7'  where audience = 'child'  and category is null;
alter table public.class_types alter column category set default 'adult';
alter table public.class_types alter column category set not null;

-- 2. Per-category trial usage ------------------------------------------------
create table if not exists public.free_trial_usage (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  category text not null,
  used_at  timestamptz not null default now(),
  primary key (user_id, category)
);
alter table public.free_trial_usage enable row level security;
-- Read own (or admin). Writes happen only inside check_in_booking (definer),
-- so there is intentionally no insert/update policy — clients can't tamper.
drop policy if exists ftu_read on public.free_trial_usage;
create policy ftu_read on public.free_trial_usage
  for select using (user_id = auth.uid() or public.is_admin());

-- 3. guard_profile_role — role guard only (free_session_used is gone). -------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    if auth.uid() is not null and not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
      new.role := old.role;
    end if;
  end if;
  return new;
end;
$$;

-- 4. check_in_booking — consume the session's category trial on attendance. --
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

  -- First attendance in a category consumes that category's free trial.
  insert into public.free_trial_usage (user_id, category)
  select v_booking.user_id, ct.category
    from public.sessions s
    join public.class_types ct on ct.id = s.class_type_id
   where s.id = v_booking.session_id and ct.category is not null
  on conflict (user_id, category) do nothing;

  return true;
end;
$$;

-- 5. Drop the superseded global flag. ---------------------------------------
alter table public.profiles drop column if exists free_session_used;
