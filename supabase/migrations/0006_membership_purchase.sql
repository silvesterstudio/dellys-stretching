-- ============================================================================
-- Dellys — online membership purchase flow
--   * `featured` flag + the highlighted 999 MDL / 16-session / 2-month offer
--   * membership_requests: client asks to buy, admin confirms with one click
-- Idempotent: safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Featured plans (visually highlighted on the memberships page)
-- ---------------------------------------------------------------------------
alter table public.membership_plans
  add column if not exists featured boolean not null default false;

-- The promoted offer: 16 sessions over 2 months (8 / month) for 999 MDL.
insert into public.membership_plans
  (audience, name_ro, name_ru, session_count, price, currency, validity_days, sort_order, featured, active)
values
  ('adult', '16 ședințe · 2 luni', '16 занятий · 2 месяца', 16, 999, 'MDL', 60, 0, true, true)
on conflict (audience, name_ro) do update set
  name_ru       = excluded.name_ru,
  session_count = excluded.session_count,
  price         = excluded.price,
  currency      = excluded.currency,
  validity_days = excluded.validity_days,
  sort_order    = excluded.sort_order,
  featured      = excluded.featured,
  active        = true;

-- ---------------------------------------------------------------------------
-- membership_requests — a client's request to buy a plan, pending admin review
-- ---------------------------------------------------------------------------
create table if not exists public.membership_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  plan_id       uuid not null references public.membership_plans(id) on delete restrict,
  status        text not null default 'pending'
                  check (status in ('pending','approved','rejected','cancelled')),
  note          text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles(id) on delete set null,
  membership_id uuid references public.user_memberships(id) on delete set null
);
create index if not exists membership_requests_user_idx
  on public.membership_requests (user_id);
create index if not exists membership_requests_pending_idx
  on public.membership_requests (created_at) where status = 'pending';
-- At most one OPEN (pending) request per user+plan.
create unique index if not exists membership_requests_pending_uniq
  on public.membership_requests (user_id, plan_id) where status = 'pending';

alter table public.membership_requests enable row level security;

-- Read own (or admin all). All writes go through the SECURITY DEFINER RPCs
-- below, which bypass RLS, so no insert/update policies are needed.
drop policy if exists mr_read on public.membership_requests;
create policy mr_read on public.membership_requests
  for select using (user_id = auth.uid() or public.is_admin());

-- ---------------------------------------------------------------------------
-- request_membership — client asks to buy a plan. Idempotent: returns the
-- existing pending request if one already exists for this user+plan.
-- ---------------------------------------------------------------------------
create or replace function public.request_membership(p_plan_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req  uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not exists (select 1 from public.membership_plans where id = p_plan_id and active) then
    raise exception 'PLAN_NOT_FOUND';
  end if;

  select id into v_req from public.membership_requests
    where user_id = v_user and plan_id = p_plan_id and status = 'pending' limit 1;
  if v_req is not null then return v_req; end if;

  insert into public.membership_requests (user_id, plan_id)
    values (v_user, p_plan_id)
    returning id into v_req;
  return v_req;
end;
$$;

-- ---------------------------------------------------------------------------
-- cancel_membership_request — owner (or admin) withdraws a pending request.
-- ---------------------------------------------------------------------------
create or replace function public.cancel_membership_request(p_request_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_req  public.membership_requests%rowtype;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_req from public.membership_requests where id = p_request_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_req.user_id <> v_user and not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  if v_req.status <> 'pending' then raise exception 'NOT_PENDING'; end if;

  update public.membership_requests
    set status = 'cancelled', decided_at = now()
    where id = p_request_id;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- decide_membership_request — ADMIN confirms (creates the membership) or
-- rejects a pending request, atomically.
-- ---------------------------------------------------------------------------
create or replace function public.decide_membership_request(
  p_request_id uuid,
  p_approve    boolean
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_req   public.membership_requests%rowtype;
  v_plan  public.membership_plans%rowtype;
  v_mem   uuid;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  select * into v_req from public.membership_requests where id = p_request_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_req.status <> 'pending' then raise exception 'NOT_PENDING'; end if;

  if p_approve then
    select * into v_plan from public.membership_plans where id = v_req.plan_id;
    if not found then raise exception 'PLAN_NOT_FOUND'; end if;

    insert into public.user_memberships
      (user_id, plan_id, sessions_remaining, expires_at, assigned_by, note)
    values
      (v_req.user_id, v_req.plan_id, v_plan.session_count,
       now() + (v_plan.validity_days || ' days')::interval, v_admin, 'online request')
    returning id into v_mem;

    update public.membership_requests
      set status = 'approved', decided_at = now(), decided_by = v_admin, membership_id = v_mem
      where id = p_request_id;
    return v_mem;
  else
    update public.membership_requests
      set status = 'rejected', decided_at = now(), decided_by = v_admin
      where id = p_request_id;
    return null;
  end if;
end;
$$;

grant execute on function public.request_membership(uuid)         to authenticated;
grant execute on function public.cancel_membership_request(uuid)  to authenticated;
grant execute on function public.decide_membership_request(uuid, boolean) to authenticated;
