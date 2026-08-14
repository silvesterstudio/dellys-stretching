-- Dellys — name the studios after the Chisinau sector each one sits in, which
-- is how locals actually refer to them.
--
--   str. Trandafirilor 20  -> Botanica
--   bd. Moscova 6, et. 3   -> Rîșcani
--
-- Supersedes 0028. Display names only: the `key` values ('trandafirilor',
-- 'moscova') are unchanged because profiles.location_id lookups, the location
-- cookie and scripts/setup-0024.mjs all reference them.

update public.locations set name = 'Botanica' where key = 'trandafirilor';
update public.locations set name = 'Rîșcani'  where key = 'moscova';
