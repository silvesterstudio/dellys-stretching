-- ============================================================================
-- Dellys — triggers, RPCs and Row Level Security
-- ============================================================================

-- ---------------------------------------------------------------------------
-- New auth user -> profile. Runs as definer so it can write profiles.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, preferred_lang)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data->>'preferred_lang', 'ro')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Prevent privilege self-escalation: only an existing admin may change role.
-- ---------------------------------------------------------------------------
create or replace function public.guard_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role then
    -- Allow service-role / direct SQL (no JWT, auth.uid() is null) to manage
    -- roles for provisioning; block authenticated non-admins from escalating.
    if auth.uid() is not null and not exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    ) then
      raise exception 'FORBIDDEN: only an admin can change roles';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_role_trg on public.profiles;
create trigger guard_profile_role_trg
  before update on public.profiles
  for each row execute function public.guard_profile_role();

-- ---------------------------------------------------------------------------
-- keep bookings.updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists bookings_touch on public.bookings;
create trigger bookings_touch
  before update on public.bookings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- is_admin() — used by RLS policies and RPCs
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------------------
-- book_session — the atomic booking. Locks the session row so concurrent
-- callers cannot oversell the last seat. Raises a coded exception on failure.
-- NOTE: the no-membership open-booking cap literal (3) must match
-- MAX_OPEN_BOOKINGS_NO_MEMBERSHIP in src/lib/constants.ts.
-- ---------------------------------------------------------------------------
create or replace function public.book_session(
  p_session_id uuid,
  p_child_id   uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user      uuid := auth.uid();
  v_session   public.sessions%rowtype;
  v_audience  text;
  v_booking   uuid;
  v_open      int;
  v_has_mem   boolean;
begin
  if v_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  -- Serialize on the session row.
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

  select audience into v_audience from public.class_types where id = v_session.class_type_id;

  -- Child rules: required & owned for child classes; ignored for adult classes.
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

  -- Duplicate active booking (also enforced by bookings_active_uniq).
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

  -- "Book freely, pay later" guard: cap open future bookings for users with no
  -- valid membership so traffic can't reserve unlimited seats it won't pay for.
  select exists (
    select 1 from public.user_memberships
    where user_id = v_user and sessions_remaining > 0 and expires_at > now()
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
$$;

-- ---------------------------------------------------------------------------
-- cancel_booking — client cancels their own future booking; frees the seat.
-- (No membership change: sessions are only deducted at check-in.)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
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

  update public.bookings set status = 'cancelled' where id = p_booking_id;
  update public.sessions
    set booked_count = greatest(0, booked_count - 1)
    where id = v_booking.session_id;

  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- check_in_booking — ADMIN marks a client present. If a membership is supplied,
-- one session is deducted (validity + remaining checked under a row lock).
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
  v_booking public.bookings%rowtype;
  v_mem     public.user_memberships%rowtype;
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

-- ===========================================================================
-- Row Level Security
-- ===========================================================================
alter table public.class_types       enable row level security;
alter table public.weekly_templates  enable row level security;
alter table public.sessions          enable row level security;
alter table public.profiles          enable row level security;
alter table public.children          enable row level security;
alter table public.membership_plans  enable row level security;
alter table public.user_memberships  enable row level security;
alter table public.bookings          enable row level security;

-- class_types: world-readable; admin writes.
create policy class_types_read on public.class_types
  for select using (true);
create policy class_types_admin on public.class_types
  for all using (public.is_admin()) with check (public.is_admin());

-- weekly_templates: admin only.
create policy templates_admin on public.weekly_templates
  for all using (public.is_admin()) with check (public.is_admin());

-- sessions: world-readable; admin writes (counts mutated only via RPCs).
create policy sessions_read on public.sessions
  for select using (true);
create policy sessions_admin on public.sessions
  for all using (public.is_admin()) with check (public.is_admin());

-- membership_plans: world-readable; admin writes.
create policy plans_read on public.membership_plans
  for select using (true);
create policy plans_admin on public.membership_plans
  for all using (public.is_admin()) with check (public.is_admin());

-- profiles: read own (or admin all); update own (role guarded by trigger).
create policy profiles_read on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_update on public.profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- children: full control by the owning parent; admin may read.
create policy children_owner on public.children
  for all using (parent_id = auth.uid()) with check (parent_id = auth.uid());
create policy children_admin_read on public.children
  for select using (public.is_admin());

-- user_memberships: read own (or admin); writes admin only (assigned at reception).
create policy memberships_read on public.user_memberships
  for select using (user_id = auth.uid() or public.is_admin());
create policy memberships_admin_write on public.user_memberships
  for all using (public.is_admin()) with check (public.is_admin());

-- bookings: read own (or admin). Inserts happen via book_session (definer).
-- Admins may update (no_show / attended fallback). Cancels via cancel_booking.
create policy bookings_read on public.bookings
  for select using (user_id = auth.uid() or public.is_admin());
create policy bookings_admin_update on public.bookings
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- Grants — expose RPCs to the API roles.
-- ---------------------------------------------------------------------------
grant execute on function public.book_session(uuid, uuid)        to authenticated;
grant execute on function public.cancel_booking(uuid)            to authenticated;
grant execute on function public.check_in_booking(uuid, uuid)    to authenticated;
grant execute on function public.is_admin()                      to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Realtime — broadcast session occupancy changes to the public schedule.
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.sessions;
