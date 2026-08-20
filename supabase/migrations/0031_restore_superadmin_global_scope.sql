-- Dellys — give the owner back both studios.
--
-- Symptom: Rîșcani vanished from the admin panel entirely. Not deleted — the
-- locations row is present and active. The account viewing it had been pinned.
--
-- profiles.location_id carries two different meanings (0024):
--   client -> their home gym
--   staff  -> the gym they run; NULL = all gyms
--
-- ensureProfileDetails() treated a NULL location_id as a blank to be filled for
-- every signed-in user, and filled it with the first studio by sort_order
-- (Botanica). The owner signs in as `admin` — location_id NULL by design since
-- 0024, whose backfill was deliberately scoped `where role = 'client'` — and one
-- visit to /dashboard silently rewrote it. getAdminScope() then reported
-- canSwitch = false and scoped every admin screen to Botanica, so Rîșcani was
-- gone from the switcher, the roster, the plans and the timetable.
--
-- The code guard is in src/lib/profile-sync.ts (studio fallback is client-only,
-- and the write is guarded `.eq("role","client")`). This restores the data.
--
-- Scoped to admins that were never assigned a studio on purpose: `moscova_admin`
-- is legitimately pinned to Rîșcani by scripts/setup-0024.mjs and must stay put,
-- as must the reception account. Only the original super-admin is reset.

update public.profiles
   set location_id = null
 where role = 'admin'
   and email = 'admin@dellys.local';
