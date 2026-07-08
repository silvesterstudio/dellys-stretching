-- ============================================================================
-- Dellys — transfer existing (offline / Excel) memberships into digital accounts
-- ============================================================================
-- The studio keeps its current clients + membership balances in a spreadsheet.
-- This migration lets an admin import those rows into a staging table
-- (`legacy_memberships`) and have each row automatically become a real
-- `user_memberships` record the moment the matching person exists as an account
-- — matched by phone number (primary) or email (fallback).
--
-- Flow:
--   1. Admin imports rows  -> legacy_memberships (status = 'pending').
--   2. admin_autolink_legacy() links any row whose phone/email already matches
--      exactly one client account (run right after import).
--   3. claim_legacy_memberships() runs for a signed-in user (on dashboard load
--      and after they edit their phone) and claims their own pending rows — so a
--      client who registers AFTER the import still gets their membership.
--   4. admin_claim_legacy() lets an admin manually link a row to a chosen account
--      (for phone typos / ambiguous matches).
--
-- Idempotent. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- normalize_phone — canonical match key for a phone number.
--   Strips everything but digits, drops a Moldova country code (373) and any
--   leading zeros, and keeps the last 8 digits (MD national number length). So
--   "+373 68 344 333", "068 344 333" and "68344333" all collapse to "68344333".
--   Returns NULL when there aren't enough digits to be a real number.
-- IMMUTABLE so it can back a generated column.
-- ---------------------------------------------------------------------------
create or replace function public.normalize_phone(p text)
returns text
language sql
immutable
as $$
  select case
    when p is null then null
    else (
      with digits as (select regexp_replace(p, '\D', '', 'g') as d)
      select case
        when length(d) < 8 then null
        -- MD country code 373 in front of the 8-digit national number.
        when length(d) >= 11 and left(d, 3) = '373' then right(d, 8)
        else right(d, 8)
      end
      from digits
    )
  end;
$$;

-- ---------------------------------------------------------------------------
-- System plans: hidden placeholder plans that transferred memberships hang off.
--   user_memberships.plan_id is NOT NULL, but a legacy balance doesn't map to a
--   real catalog plan — so we attach it to a per-audience "transferred" plan.
--   `system_key` is a stable handle independent of the display name.
--   active = false keeps them off the public price list and admin assign menu;
--   price = 0 keeps them out of revenue totals.
-- ---------------------------------------------------------------------------
alter table public.membership_plans
  add column if not exists system_key text;
create unique index if not exists membership_plans_system_key_uniq
  on public.membership_plans (system_key) where system_key is not null;

insert into public.membership_plans
  (audience, name_ro, name_ru, session_count, price, currency, validity_days,
   active, featured, sort_order, system_key)
values
  ('adult', 'Abonament transferat', 'Перенесённый абонемент', 1, 0, 'MDL', 1,
   false, false, 999, 'transfer_adult'),
  ('child', 'Abonament transferat (copii)', 'Перенесённый абонемент (дети)', 1, 0, 'MDL', 1,
   false, false, 999, 'transfer_child')
on conflict (audience, name_ro) do update set
  system_key = excluded.system_key,
  active     = false;

-- ---------------------------------------------------------------------------
-- legacy_memberships — one imported spreadsheet row.
-- ---------------------------------------------------------------------------
create table if not exists public.legacy_memberships (
  id                   uuid primary key default gen_random_uuid(),
  full_name            text,
  phone                text,
  -- Generated canonical phone used for matching; indexed below.
  phone_norm           text generated always as (public.normalize_phone(phone)) stored,
  email                text,
  audience             text not null default 'adult' check (audience in ('adult','child')),
  plan_label           text,                    -- the plan/type as written in the sheet
  sessions_remaining   int  not null default 0 check (sessions_remaining >= 0),
  expires_at           timestamptz not null,
  note                 text,
  status               text not null default 'pending'
                         check (status in ('pending','claimed','void')),
  claimed_by_user_id   uuid references public.profiles(id) on delete set null,
  claimed_membership_id uuid references public.user_memberships(id) on delete set null,
  claimed_at           timestamptz,
  imported_by          uuid references public.profiles(id) on delete set null,
  created_at           timestamptz not null default now()
);
create index if not exists legacy_memberships_phone_pending_idx
  on public.legacy_memberships (phone_norm) where status = 'pending';
create index if not exists legacy_memberships_email_pending_idx
  on public.legacy_memberships (lower(email)) where status = 'pending';

alter table public.legacy_memberships enable row level security;

-- Admins can read (and the service-role import bypasses RLS anyway). All state
-- transitions go through the SECURITY DEFINER functions below.
drop policy if exists legacy_read on public.legacy_memberships;
create policy legacy_read on public.legacy_memberships
  for select using (public.is_admin());

-- ---------------------------------------------------------------------------
-- link_legacy(legacy_id, user_id) — INTERNAL. Materialize one pending legacy row
--   into a real user_memberships record and mark it claimed. Row-locked and
--   status-guarded so it can never double-claim. Not granted to clients; only
--   reachable through the wrappers below.
-- ---------------------------------------------------------------------------
create or replace function public.link_legacy(p_legacy_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row  public.legacy_memberships%rowtype;
  v_plan uuid;
  v_mem  uuid;
begin
  select * into v_row from public.legacy_memberships
    where id = p_legacy_id for update;
  if not found then raise exception 'LEGACY_NOT_FOUND'; end if;
  if v_row.status <> 'pending' then raise exception 'LEGACY_NOT_PENDING'; end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'USER_NOT_FOUND';
  end if;

  select id into v_plan from public.membership_plans
    where system_key = case when v_row.audience = 'child'
                            then 'transfer_child' else 'transfer_adult' end;
  if v_plan is null then raise exception 'TRANSFER_PLAN_MISSING'; end if;

  insert into public.user_memberships
    (user_id, plan_id, sessions_remaining, expires_at, assigned_by, note)
  values
    (p_user_id, v_plan, greatest(v_row.sessions_remaining, 0), v_row.expires_at,
     v_row.imported_by,
     coalesce(nullif('Transfer: ' || coalesce(v_row.plan_label, ''), 'Transfer: '),
              'Abonament transferat'))
  returning id into v_mem;

  update public.legacy_memberships
    set status = 'claimed', claimed_by_user_id = p_user_id,
        claimed_membership_id = v_mem, claimed_at = now()
    where id = p_legacy_id;

  return v_mem;
end;
$$;

revoke all on function public.link_legacy(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- claim_legacy_memberships — the SIGNED-IN USER claims their own pending rows,
--   matched by their profile phone (primary) or email (fallback). Idempotent:
--   safe to call on every dashboard load. Returns how many were claimed.
-- ---------------------------------------------------------------------------
create or replace function public.claim_legacy_memberships()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  uuid := auth.uid();
  v_phone text;
  v_email text;
  v_count int := 0;
  r       record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select public.normalize_phone(phone), lower(nullif(email, ''))
    into v_phone, v_email
    from public.profiles where id = v_user;

  if v_phone is null and v_email is null then return 0; end if;

  for r in
    select id from public.legacy_memberships
    where status = 'pending'
      and (
        (v_phone is not null and phone_norm = v_phone)
        or (v_email is not null and lower(email) = v_email)
      )
    for update skip locked
  loop
    perform public.link_legacy(r.id, v_user);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.claim_legacy_memberships() to authenticated;

-- ---------------------------------------------------------------------------
-- admin_claim_legacy(legacy_id, user_id) — ADMIN manually links a row to a
--   chosen account (phone typos, ambiguous matches).
-- ---------------------------------------------------------------------------
create or replace function public.admin_claim_legacy(p_legacy_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  return public.link_legacy(p_legacy_id, p_user_id);
end;
$$;

grant execute on function public.admin_claim_legacy(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_autolink_legacy — ADMIN bulk pass: link every pending row that matches
--   EXACTLY ONE client account by phone (or, failing that, exactly one by
--   email). Ambiguous rows (0 or >1 matches) are left pending for a human. Run
--   right after an import so already-registered clients get their balance now.
--   Returns how many rows were linked.
-- ---------------------------------------------------------------------------
create or replace function public.admin_autolink_legacy()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
  r       record;
  v_ids   uuid[];
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;

  for r in
    select id, phone_norm, email from public.legacy_memberships
    where status = 'pending'
    for update skip locked
  loop
    v_ids := null;

    if r.phone_norm is not null then
      select array_agg(id) into v_ids from public.profiles
        where role = 'client' and public.normalize_phone(phone) = r.phone_norm;
    end if;

    -- Fall back to email only when phone gave no candidates at all.
    if (v_ids is null or array_length(v_ids, 1) is null)
       and r.email is not null and length(r.email) > 0 then
      select array_agg(id) into v_ids from public.profiles
        where role = 'client' and lower(email) = lower(r.email);
    end if;

    if v_ids is not null and array_length(v_ids, 1) = 1 then
      perform public.link_legacy(r.id, v_ids[1]);
      v_count := v_count + 1;
    end if;
  end loop;

  return v_count;
end;
$$;

grant execute on function public.admin_autolink_legacy() to authenticated;
