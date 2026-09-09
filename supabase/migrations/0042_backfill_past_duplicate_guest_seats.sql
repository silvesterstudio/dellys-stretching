-- Dellys — give back the double-held seats on classes that have already run.
--
-- 0041 fixed the cause and cleaned up the classes that had not started yet. It
-- left past classes alone on the grounds that their counter is history. That was
-- the wrong call for this particular case: a lead sitting next to a real booking
-- from the SAME phone on the SAME class was never a second person, so the
-- counter is not history — it is simply wrong, and it feeds the occupancy and
-- attendance figures on the admin dashboard.
--
-- The class that made this visible: Popa + Press, Wed 9 Sept 19:00 at Rîșcani,
-- capacity 15, counter 15 — the only class in the whole history that ever read
-- "Complet". Seven people came in, six of them still holding the guest lead they
-- had arrived through. It drops to 9: the 7 who came, plus 2 leads (София
-- Азманова, Mihaela Cimbriciuc) who reserved and did not show.
--
-- Genuine no-shows keep their seat on purpose. They were real reservations that
-- went unused, and erasing them would hide a no-show rate the studio should be
-- able to see. Only the duplicates go.

with dup as (
  select gb.id, gb.session_id
    from public.guest_bookings gb
    join public.sessions s on s.id = gb.session_id
   where gb.seat_released = false
     and gb.status <> 'cancelled'
     and s.starts_at <= now()
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
