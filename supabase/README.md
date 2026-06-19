# Supabase setup

## 1. Create the project
Create a project at https://supabase.com, then copy the API keys into `.env.local`
(see `.env.local.example`): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
and `SUPABASE_SERVICE_ROLE_KEY`.

## 2. Apply migrations
Run the SQL files in `supabase/migrations/` **in order** in the Supabase SQL editor
(or via the Supabase CLI `supabase db push`):

1. `0001_init.sql` — tables & indexes
2. `0002_functions_rls.sql` — triggers, booking RPCs, Row Level Security
3. `0003_seed.sql` — class types + membership price list
4. `0004_scheduling.sql` — session generator + pending cleanup (added in Phase 7)

## 3. Auth settings
In **Authentication → Providers → Email**: enable **Email OTP** (magic code).
In **Authentication → URL Configuration**: add `NEXT_PUBLIC_SITE_URL` to the
allowed redirect URLs.

## 4. Make yourself an admin
After signing in once (so your profile exists), run in the SQL editor:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

`role` is protected from self-escalation via a trigger — only an existing admin
(or this direct SQL with the service role) can grant it.

## 5. Edge functions / cron (Phase 7)
See `supabase/functions/` and the `pg_cron` snippet in `0004_scheduling.sql` to
keep sessions materialized ~4 weeks ahead and release stale pending holds.
