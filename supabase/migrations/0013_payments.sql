-- ============================================================================
-- Dellys — payment capture on memberships (Bundle C)
--   Records how much was actually collected for each assigned/sold membership
--   and how (cash/card/transfer/free). Revenue analytics switch from the plan's
--   list price to the real amount collected, so cash sales and discounts count.
--   Backward compatible: existing rows have NULL amount_paid and fall back to
--   the plan price in the analytics.
-- ============================================================================
alter table public.user_memberships
  add column if not exists amount_paid    numeric(10,2),
  add column if not exists payment_method text;

alter table public.user_memberships
  drop constraint if exists user_memberships_payment_method_chk;
alter table public.user_memberships
  add constraint user_memberships_payment_method_chk
  check (payment_method is null or payment_method in ('cash','card','transfer','free'));
