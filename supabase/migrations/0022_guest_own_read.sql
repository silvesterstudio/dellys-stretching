-- Dellys — 0022 let members see their own guest bookings
--
-- Once a no-login guest booking is linked to an account (claimed_by), that person
-- should see the reservation in their dashboard. Guest bookings were staff-only
-- until now, so add a self-read policy scoped to the owner.
drop policy if exists "guest_bookings own read" on public.guest_bookings;
create policy "guest_bookings own read" on public.guest_bookings
  for select using (claimed_by = auth.uid());
