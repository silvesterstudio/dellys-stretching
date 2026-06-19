-- ============================================================================
-- Dellys — scheduling: materialize sessions from templates + cleanup
-- ============================================================================

-- ---------------------------------------------------------------------------
-- generate_sessions(p_weeks) — create concrete sessions for the next p_weeks
-- from every active weekly template. Idempotent via the partial unique index
-- (template_id, starts_at). Bucharest wall time -> UTC is handled by
-- "AT TIME ZONE", which is DST-correct. Only future instants are created.
--
-- Callable by an admin (via RPC) or by cron/service role (auth.uid() is null).
-- ---------------------------------------------------------------------------
create or replace function public.generate_sessions(p_weeks int default 4)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  insert into public.sessions
    (class_type_id, template_id, starts_at, duration_min, capacity, instructor)
  select
    t.class_type_id,
    t.id,
    (gs.d::date + t.start_time::time) at time zone 'Europe/Bucharest',
    t.duration_min,
    t.capacity,
    t.instructor
  from public.weekly_templates t
  cross join generate_series(
    current_date::timestamp,
    (current_date + (p_weeks * 7))::timestamp,
    interval '1 day'
  ) as gs(d)
  where t.active
    and extract(dow from gs.d)::int = t.weekday
    and ((gs.d::date + t.start_time::time) at time zone 'Europe/Bucharest') > now()
  on conflict (template_id, starts_at) where template_id is not null
  do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- release_stale_pending() — release seats held by pending reservations whose
-- TTL has elapsed (reserved for the future pre-auth-hold feature; no-op today).
-- ---------------------------------------------------------------------------
create or replace function public.release_stale_pending()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int := 0;
begin
  with released as (
    update public.bookings
      set status = 'cancelled'
      where status = 'pending'
        and expires_at is not null
        and expires_at < now()
      returning session_id
  ), agg as (
    select session_id, count(*)::int as c from released group by session_id
  )
  update public.sessions s
    set booked_count = greatest(0, s.booked_count - agg.c)
    from agg
    where s.id = agg.session_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.generate_sessions(int)   to authenticated;
grant execute on function public.release_stale_pending()   to authenticated;

-- ---------------------------------------------------------------------------
-- Schedule with pg_cron (enable the extension first in the Supabase dashboard:
-- Database -> Extensions -> pg_cron). Then run these once:
--
--   select cron.schedule('dellys-generate-sessions', '0 3 * * *',
--     $$ select public.generate_sessions(4); $$);
--   select cron.schedule('dellys-release-pending', '*/5 * * * *',
--     $$ select public.release_stale_pending(); $$);
--
-- Or invoke the Edge Function in supabase/functions/scheduled/ on a schedule.
-- ---------------------------------------------------------------------------
