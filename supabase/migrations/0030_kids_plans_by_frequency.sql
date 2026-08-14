-- Dellys — kids memberships are priced by how often the child trains, not by
-- age group. Both age groups (4-8 and 9-14) attend on the same fixed days, so
-- the age split no longer describes anything a parent is choosing between.
--
--   550 MDL — 2 days a week (Marti, Joi)            ->  8 sessions / 30 days
--   700 MDL — 3 days a week (Luni, Miercuri, Vineri) -> 12 sessions / 30 days
--
-- The existing rows are rewritten in place rather than replaced: no
-- user_memberships referenced the kids plans, and keeping the ids avoids
-- orphaning anything that might reference them later.
--
-- NOTE: this also brings Moscova in line — its kids plans were both 750 MDL.
-- The new prices apply to both studios.
--
-- Session counts are derived from the frequency over a 30-day validity
-- (2/week ~ 8, 3/week ~ 12); adjust if the studio counts differently.

update public.membership_plans
   set name_ro       = 'Copii · 2 zile pe săptămână',
       name_ru       = 'Дети · 2 дня в неделю',
       session_count = 8,
       price         = 550,
       validity_days = 30,
       sort_order    = 5,
       active        = true
 where audience = 'child'
   and system_key is null
   and name_ro like '%4-8%';

update public.membership_plans
   set name_ro       = 'Copii · 3 zile pe săptămână',
       name_ru       = 'Дети · 3 дня в неделю',
       session_count = 12,
       price         = 700,
       validity_days = 30,
       sort_order    = 6,
       active        = true
 where audience = 'child'
   and system_key is null
   and name_ro like '%9-14%';
