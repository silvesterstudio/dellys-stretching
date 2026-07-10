-- ============================================================================
-- Dellys — close the legacy-claim phone IDOR
--   claim_legacy_memberships() (self-serve, run on dashboard load + profile
--   edit) previously matched pending legacy_memberships by phone OR email.
--   phone is UNVERIFIED and freely self-editable, so a client could set their
--   profile phone to a victim's number and claim the victim's imported session
--   credits. Restrict the self-serve claim to the VERIFIED email only. Admins
--   still link by phone via admin_autolink_legacy / admin_claim_legacy (trusted,
--   admin-initiated). Purely a narrowing of the match — no signature change.
-- ============================================================================
create or replace function public.claim_legacy_memberships()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user  uuid := auth.uid();
  v_email text;
  v_count int := 0;
  r       record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  -- VERIFIED email only (magic-link OTP). Phone matching is intentionally
  -- dropped here to prevent claiming another person's balance via an unverified,
  -- user-editable phone number.
  select lower(nullif(email, '')) into v_email
    from public.profiles where id = v_user;

  if v_email is null then return 0; end if;

  for r in
    select id from public.legacy_memberships
    where status = 'pending' and lower(email) = v_email
    for update skip locked
  loop
    perform public.link_legacy(r.id, v_user);
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$function$;
