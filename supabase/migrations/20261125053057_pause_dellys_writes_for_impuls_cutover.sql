SET LOCAL lock_timeout = '5s';

CREATE SCHEMA dellys_cutover;
REVOKE ALL ON SCHEMA dellys_cutover FROM PUBLIC;

CREATE FUNCTION dellys_cutover.pause_writes() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'Dellys activity moved to Impuls Sport';
END;
$$;

DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'audit_log', 'bookings', 'checkin_logs', 'children', 'class_types', 'free_trial_usage',
    'guest_bookings', 'kiosk_devices', 'legacy_memberships', 'locations', 'membership_plans',
    'membership_requests', 'profiles', 'sessions', 'user_memberships', 'weekly_templates'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER dellys_cutover_pause BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I
       FOR EACH STATEMENT EXECUTE FUNCTION dellys_cutover.pause_writes()',
      table_name
    );
  END LOOP;
END;
$$;

CREATE TRIGGER dellys_cutover_pause
  BEFORE INSERT OR DELETE OR UPDATE OF email, encrypted_password, email_confirmed_at,
    deleted_at, banned_until, raw_user_meta_data, raw_app_meta_data, phone, is_anonymous, is_sso_user
  ON auth.users FOR EACH STATEMENT EXECUTE FUNCTION dellys_cutover.pause_writes();

CREATE TRIGGER dellys_cutover_pause
  BEFORE INSERT OR DELETE OR UPDATE OF user_id, provider, provider_id, identity_data
  ON auth.identities FOR EACH STATEMENT EXECUTE FUNCTION dellys_cutover.pause_writes();
