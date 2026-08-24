-- Dellys — put the 999 MDL / 16-session offer on sale.
--
-- The plan already existed at Botanica — 999 MDL, 16 sessions, 60 days — but
-- with active = false, so reception could not sell it and it never reached the
-- public price list. It had also never been created at Rîșcani at all, and its
-- sort_order was 0, colliding with "1 ședință".
--
-- Now: live at both studios, and ordered by price like the rest of the ladder,
-- so it reads 150 · 450 · 700 · 850 · 999 · 1300 down the dropdown instead of
-- appearing at the top next to the single visit.

-- 1. Wake it up at Botanica and give it its place in the ladder.
update public.membership_plans
   set active     = true,
       sort_order = 4
 where audience = 'adult'
   and system_key is null
   and name_ro = '16 ședințe · 2 luni';

-- 2. Everything priced above it shifts down one. Applied at every studio so the
--    two dropdowns stay identical.
update public.membership_plans set sort_order = 5
 where audience = 'adult' and system_key is null and name_ro = 'Nelimitat';
update public.membership_plans set sort_order = 6
 where audience = 'child' and system_key is null and name_ro like 'Copii · 2 zile%';
update public.membership_plans set sort_order = 7
 where audience = 'child' and system_key is null and name_ro like 'Copii · 3 zile%';

-- 3. Rîșcani never had this plan. Create it there, matching Botanica exactly.
--    Guarded so re-running cannot produce a second copy.
insert into public.membership_plans
  (audience, name_ro, name_ru, session_count, price, currency, validity_days, active, sort_order, location_id)
select 'adult', '16 ședințe · 2 luni', '16 занятий · 2 месяца', 16, 999, 'MDL', 60, true, 4, l.id
  from public.locations l
 where l.key = 'moscova'
   and not exists (
     select 1 from public.membership_plans p
      where p.location_id = l.id
        and p.audience = 'adult'
        and p.name_ro = '16 ședințe · 2 luni'
   );
