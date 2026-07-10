-- ============================================================================
-- Dellys — proper freeze + per-member notes (Bundle D)
--   freeze_start_date: when the current freeze began. On unfreeze we push
--   expires_at out by the number of days the membership was paused, so freezing
--   no longer silently burns the member's remaining days.
--   profiles.notes: free-text staff notes on a member (injuries, preferences).
-- ============================================================================
alter table public.user_memberships
  add column if not exists freeze_start_date timestamptz;

alter table public.profiles
  add column if not exists notes text;
