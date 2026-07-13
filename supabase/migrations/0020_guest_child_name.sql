-- Dellys — 0020 guest booking child name
--
-- Kids classes booked through the no-login funnel need the child's name in
-- addition to the parent's name + phone, so staff know who is actually attending.
alter table public.guest_bookings
  add column if not exists child_name text;
