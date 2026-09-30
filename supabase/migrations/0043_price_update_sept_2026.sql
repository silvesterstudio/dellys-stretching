-- Dellys — new price list, from 30 Sept 2026.
--
--   adult   4 ședințe    450 -> 500
--   adult   8 ședințe    700 -> 800
--   adult  12 ședințe    850 -> 950
--   adult  Nelimitat    1300 -> 1500
--   adult  1 ședință     150 (unchanged — the single visit and the trial are the
--                             same 150; the free trial was retired in 0032, so
--                             there is no separate trial plan to price)
--   kids   2 zile/săpt.  550 -> 700
--   kids   3 zile/săpt.  700 (unchanged)
--
-- Applied to every studio so the price lists stay identical, Botanica's
-- (archived, 0040) included — it would otherwise come back on the old prices.
-- The retired 16-ședințe bundle (0039) is left alone.

-- 1. Freeze what was already sold.
--
-- The admin statistics value a membership at `amount_paid` when it has one and
-- fall back to the plan's CURRENT list price when it does not. Nine memberships
-- on these plans have no amount_paid, so repricing the plan would have quietly
-- rewritten their history — about 750 MDL of revenue that was never collected.
-- Stamping them with the price in force when they were sold makes the history
-- immune to this change and to every later one.
update public.user_memberships m
   set amount_paid = p.price
  from public.membership_plans p
 where p.id = m.plan_id
   and m.amount_paid is null
   and p.system_key is null;

-- 2. The new prices.
update public.membership_plans
   set price = case
     when audience = 'adult' and session_count = 4   then 500
     when audience = 'adult' and session_count = 8   then 800
     when audience = 'adult' and session_count = 12  then 950
     when audience = 'adult' and session_count = 999 then 1500   -- Nelimitat (999 = the unlimited convention)
     when audience = 'child'                          then 700
     else price
   end
 where system_key is null
   and active;
