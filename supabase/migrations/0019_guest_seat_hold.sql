-- Dellys — 0019 guest seat hold
--
-- A no-login "first reservation" now holds a real seat so the public schedule's
-- "locuri libere" count drops immediately. These run from the server action via
-- the service role; execute is revoked from anon/authenticated so the counter
-- can't be manipulated with the public anon key.

-- Atomically take a seat only while the class is still open. Returns true on
-- success, false if the class is full / cancelled / already started.
create or replace function public.hold_guest_seat(p_session_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.sessions
     set booked_count = booked_count + 1
   where id = p_session_id
     and status = 'scheduled'
     and starts_at > now()
     and booked_count < capacity;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

-- Give a held seat back (failed insert, or a lead is cancelled). Floors at 0.
create or replace function public.release_guest_seat(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
     set booked_count = greatest(0, booked_count - 1)
   where id = p_session_id;
end;
$$;

revoke execute on function public.hold_guest_seat(uuid) from anon, authenticated;
revoke execute on function public.release_guest_seat(uuid) from anon, authenticated;
grant execute on function public.hold_guest_seat(uuid) to service_role;
grant execute on function public.release_guest_seat(uuid) to service_role;
