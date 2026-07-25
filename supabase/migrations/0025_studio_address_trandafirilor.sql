-- ============================================================================
-- Correct the original studio's identity: Trandafirilor 20, not Asachi 65
-- ============================================================================
-- 0024 seeded the first location from the address the site had been publishing
-- (footer + landing JSON-LD): "str. Gheorghe Asachi 65". That address was stale.
-- The studio is at str. Trandafirilor 20.
--
-- Renames the row in place rather than inserting a new one, so every
-- location_id already stamped on sessions, templates, plans, profiles, kiosk
-- devices and check-in logs keeps pointing at the same studio.
--
-- The `key` changes too, because it appears in the ?loc= URL and in the
-- visitor's remembered-choice cookie. A stale cookie simply fails to match and
-- falls back to the first studio, which is harmless.
--
-- Idempotent. Safe to re-run.
-- ============================================================================

update public.locations
   set key        = 'trandafirilor',
       name       = 'Dellys Trandafirilor',
       address_ro = 'str. Trandafirilor 20, Chișinău',
       address_ru = 'ул. Трандафирилор 20, Кишинэу'
 where key = 'asachi';

-- The tablet label is shown to staff in the admin kiosk panel.
update public.kiosk_devices d
   set label = 'Tabletă recepție — ' || l.name
  from public.locations l
 where l.id = d.location_id
   and d.label is distinct from ('Tabletă recepție — ' || l.name);
