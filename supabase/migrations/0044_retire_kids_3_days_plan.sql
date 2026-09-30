-- Dellys — kids now have a single plan: 2 days a week, 700 MDL.
--
-- The 3-days-a-week plan (12 sessions, Luni / Miercuri / Vineri) is taken off
-- sale at every studio. Deactivated rather than deleted, like the other retired
-- plans (0039): nothing was ever sold on it, but the row keeps its id and can be
-- switched back on from /admin/plans, or with
--   update public.membership_plans set active = true
--    where audience = 'child' and name_ro like 'Copii · 3 zile%';
--
-- The 2-days plan was already set to 700 in 0043.

update public.membership_plans
   set active   = false,
       featured = false
 where audience = 'child'
   and system_key is null
   and name_ro like 'Copii · 3 zile%';
