-- Dellys — stop a guest lead and its own real booking from taking two seats.
--
-- THE BUG. A no-login "rezervă" form submission takes a real seat through
-- hold_guest_seat (0019). When that same person then gets an actual booking —
-- reception converts the lead, they sign up themselves, or they are checked in
-- at the kiosk — a `bookings` row is created and takes a SECOND seat. Nothing
-- ever gave the first one back: release_guest_seat ran only when a staff member
-- explicitly set the lead to 'cancelled'.
--
-- Seen on Popa + Press, Wed 9 Sept 19:00 (Rîșcani, capacity 15): 7 people came
-- in, 6 of them were also still holding their original guest lead, plus 2 leads
-- who never showed. 7 + 8 = 15, so the class read "Complet" and turned real
-- bookings away with half the room empty.
--
-- THE FIX. Whether a lead is still holding a seat is a different question from
-- where it sits in the sales pipeline, so it gets its own column instead of
-- being inferred from `status` (which staff move around freely, and which would
-- double-release on a later 'cancelled'). A booking arriving for the same class
-- and the same phone number hands the seat over: the lead's seat is marked
-- released exactly once, and the session's counter drops by however many were
-- actually freed.
--
-- Phone numbers are stored inconsistently (+37378554247, 069393542, 79351793),
-- so matching is on the last 8 digits — the part that identifies the subscriber
-- in Moldova regardless of the +373 / 0 prefix.
--
-- NOT addressed here, still an open question: a lead that never becomes a
-- booking and is never cancelled holds its seat forever. 219 of 232 leads ever
-- created are still sitting at 'new'. That needs a TTL, which is a policy call.

-- ---------------------------------------------------------------------------
-- 1. Track the seat separately from the pipeline status
-- ---------------------------------------------------------------------------
alter table public.guest_bookings
  add column if not exists seat_released boolean not null default false;

comment on column public.guest_bookings.seat_released is
  'True once this lead''s held seat has been given back — by cancelling it, or '
  'by the same person getting a real booking on that class. Guards against '
  'releasing the same seat twice.';

-- A lead cancelled before today already had its seat released by
-- release_guest_seat, so record that before the guard starts being enforced.
update public.guest_bookings
   set seat_released = true
 where status = 'cancelled';

-- ---------------------------------------------------------------------------
-- 2. Hand the seat over when a booking shows up for the same person
-- ---------------------------------------------------------------------------
create or replace function public.release_guest_seat_for_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
  v_freed int;
begin
  select right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 8)
    into v_phone
    from public.profiles p
   where p.id = new.user_id;

  -- Too short to identify anyone: leave the seat alone rather than guess.
  if v_phone is null or length(v_phone) < 8 then
    return new;
  end if;

  -- Flip and count in one statement: whatever this UPDATE actually changed is
  -- exactly what we may subtract, so concurrent bookings cannot double-free a
  -- seat between the read and the write.
  with freed as (
    update public.guest_bookings gb
       set seat_released = true
     where gb.session_id = new.session_id
       and gb.seat_released = false
       and gb.status <> 'cancelled'
       and right(regexp_replace(coalesce(gb.phone, ''), '\D', '', 'g'), 8) = v_phone
    returning 1
  )
  select count(*) into v_freed from freed;

  if v_freed > 0 then
    update public.sessions
       set booked_count = greatest(0, booked_count - v_freed)
     where id = new.session_id;
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_release_guest_seat on public.bookings;
create trigger bookings_release_guest_seat
  after insert on public.bookings
  for each row
  when (new.status in ('pending', 'booked', 'attended'))
  execute function public.release_guest_seat_for_booking();

-- ---------------------------------------------------------------------------
-- 3. Give back the seats that are double-held right now
-- ---------------------------------------------------------------------------
-- Only classes that have not started yet: a past session's counter is history,
-- and rewriting it would misreport how full the room actually was.
with dup as (
  select gb.id, gb.session_id
    from public.guest_bookings gb
    join public.sessions s on s.id = gb.session_id
   where gb.seat_released = false
     and gb.status <> 'cancelled'
     and s.starts_at > now()
     and length(regexp_replace(coalesce(gb.phone, ''), '\D', '', 'g')) >= 8
     and exists (
       select 1
         from public.bookings b
         join public.profiles p on p.id = b.user_id
        where b.session_id = gb.session_id
          and b.status in ('pending', 'booked', 'attended')
          and right(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), 8)
            = right(regexp_replace(coalesce(gb.phone, ''), '\D', '', 'g'), 8)
     )
),
freed as (
  update public.guest_bookings gb
     set seat_released = true
    from dup
   where gb.id = dup.id
  returning gb.session_id
)
update public.sessions s
   set booked_count = greatest(0, s.booked_count - f.n)
  from (select session_id, count(*) as n from freed group by session_id) f
 where s.id = f.session_id;
