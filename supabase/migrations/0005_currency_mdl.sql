-- ============================================================================
-- Dellys — switch currency from RON to MDL
-- Updates the default and any existing membership_plans rows.
-- Idempotent: safe to re-run.
-- ============================================================================

alter table public.membership_plans
  alter column currency set default 'MDL';

update public.membership_plans
  set currency = 'MDL'
  where currency = 'RON';
