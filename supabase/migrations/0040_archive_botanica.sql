-- Dellys — archive the Botanica studio (str. Trandafirilor 20).
--
-- Classes there have stopped: at the time of writing Botanica had 0 upcoming
-- sessions and no pinned staff, while Rîșcani had 50 upcoming sessions and 46
-- live memberships. The studio is put away rather than deleted — everything it
-- ever produced (past sessions, bookings, check-ins, memberships, its own price
-- list) stays in the database, keyed to this row.
--
-- `active = false` is the archive switch the app already had: fetchLocations()
-- in src/lib/locations-server.ts returns only active gyms, so Botanica drops out
-- of the public site — the studio chooser, the programme's studio switcher
-- (ScheduleGrid renders it only when locations.length > 1), the sign-up form's
-- studio picker, and the admin location bar.
--
-- With one gym left, the site root stops being a chooser and redirects to
-- /program (src/app/[lang]/page.tsx), so dellys.md lands on Rîșcani's schedule.
--
-- TO BRING BOTANICA BACK — this single statement, nothing else:
--   update public.locations set active = true where key = 'trandafirilor';
-- The chooser, the switchers and the pickers all reappear on their own.

update public.locations
   set active = false
 where key = 'trandafirilor';
