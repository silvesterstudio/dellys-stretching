-- Dellys — drop the redundant "Dellys " prefix from the studio display names.
--
-- These render on the studio chooser (and the sign-up studio picker) directly
-- under the Dellys logo, so "Dellys Trandafirilor" repeated the brand twice on
-- the same screen. The `key` values are unchanged — they are referenced by
-- profiles.location_id lookups, the location cookie and scripts/setup-0024.mjs.

update public.locations set name = 'Trandafirilor' where key = 'trandafirilor';
update public.locations set name = 'Moscova'       where key = 'moscova';
