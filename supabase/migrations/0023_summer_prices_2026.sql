-- ============================================================================
-- Dellys — SUMMER 2026 price list (temporary promotion)
--   Adult plans: 1 ședință 150 · 4 ședințe 450 · 8 ședințe 700 ·
--                12 ședințe 850 · Nelimitat 1300 (MDL)
--   The 16-ședințe/2-luni bundle (999 MDL) is paused for the summer.
--   Kids plans are unchanged.
--
--   ⚠ TEMPORARY: after the summer the standard prices come back —
--   revert with the block at the bottom (kept commented out).
-- Idempotent. Safe to re-run. Applied to prod via REST on 2026-07-18.
-- ============================================================================

-- Discounted prices on the existing adult plans.
update public.membership_plans set price = 450 where audience = 'adult' and name_ro = '4 ședințe';
update public.membership_plans set price = 700 where audience = 'adult' and name_ro = '8 ședințe';
update public.membership_plans set price = 850 where audience = 'adult' and name_ro = '12 ședințe';

-- Pause the 2-month bundle while the summer list is live.
update public.membership_plans
  set active = false, featured = false
  where audience = 'adult' and name_ro = '16 ședințe · 2 luni';

-- New summer plans: single visit + unlimited (999 = the app's ∞ convention,
-- same as unlimited legacy transfers).
insert into public.membership_plans
  (audience, name_ro, name_ru, session_count, price, currency, validity_days, sort_order, featured, active)
values
  ('adult', '1 ședință', '1 занятие', 1,   150,  'MDL', 30, 0, false, true),
  ('adult', 'Nelimitat', 'Безлимит',  999, 1300, 'MDL', 30, 4, false, true)
on conflict (audience, name_ro) do update set
  name_ru       = excluded.name_ru,
  session_count = excluded.session_count,
  price         = excluded.price,
  validity_days = excluded.validity_days,
  sort_order    = excluded.sort_order,
  active        = true;

-- ----------------------------------------------------------------------------
-- AFTER SUMMER — restore the standard price list (also remove the summer
-- pricing UI in src/components/PricingTeaser.tsx):
--
-- update public.membership_plans set price = 650  where audience='adult' and name_ro='4 ședințe';
-- update public.membership_plans set price = 1050 where audience='adult' and name_ro='8 ședințe';
-- update public.membership_plans set price = 1300 where audience='adult' and name_ro='12 ședințe';
-- update public.membership_plans set active = true, featured = true
--   where audience='adult' and name_ro='16 ședințe · 2 luni';
-- update public.membership_plans set active = false
--   where audience='adult' and name_ro in ('1 ședință', 'Nelimitat');
-- ----------------------------------------------------------------------------
