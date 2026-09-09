-- Dellys — retire the 999 MDL / 16-ședințe / 2-luni bundle.
--
-- The studio has stopped selling it. It came back on sale in
-- 0035_activate_16_session_plan.sql; this takes it off the price list again, at
-- both studios, and the landing/program teaser card was removed in the same
-- change (src/components/PricingTeaser.tsx).
--
-- Deactivated rather than deleted, on purpose: user_memberships.plan_id and
-- membership_requests.plan_id are `on delete restrict`, and clients still hold
-- memberships bought on this plan. Dropping the row would either fail or erase
-- their history and the revenue it feeds into admin statistics. `active = false`
-- is what the app's own "delete plan" button falls back to for this reason
-- (deletePlanAction in src/app/[lang]/admin/actions.ts).
--
-- Effect of active = false:
--   * gone from the public price list       (/[lang]/memberships filters active)
--   * gone from reception's assign dropdown (/[lang]/admin/members filters active)
--   * cannot be sold — assignMembershipAction returns PLAN_INACTIVE
--   * still listed, dimmed, in the admin price catalog (/[lang]/admin/plans),
--     which is the screen whose job is to show every plan including retired ones

update public.membership_plans
   set active = false,
       featured = false
 where audience = 'adult'
   and system_key is null
   and name_ro = '16 ședințe · 2 luni';
