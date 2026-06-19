# Dellys — gym class booking

A booking web app for a girls' gym (Romania). The product exists to close the
funnel between ads and an actual check-in: visitors see the class schedule with
**no login wall**, and only sign up (email + 6-digit code) at the moment they
reserve a seat. Memberships are sold at reception and assigned by an admin; a
session is deducted only when the client is checked in.

Languages: **Română (ro)** and **Русский (ru)**.

## Stack

- **Next.js 15** (App Router, SSR) + **React 19** + **Tailwind CSS**
- **Supabase** — Postgres, Auth (email OTP), Row Level Security, Realtime, Edge Functions
- Deploy on **Vercel**

## Features

- Public weekly **schedule** (SSR) with live "spots left" counts via Supabase Realtime
- **Email OTP** sign-in/up (no passwords)
- **Booking** with an atomic, race-safe Postgres RPC (no overselling the last seat)
- Children profiles for **gimnastică** (parent books and names the child)
- **Client dashboard**: upcoming bookings (with cancel), history, memberships & sessions left
- Public **membership price list**
- **Admin panel**: weekly schedule templates, session generation, roster + check-in
  (deducts a session from a membership), no-show marking, membership assignment, member search
- Timezone-correct (Europe/Bucharest, DST-safe) throughout

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase keys
npm run dev
```

Then set up Supabase — see **[supabase/README.md](supabase/README.md)**:
apply the migrations in `supabase/migrations/` in order, enable Email OTP, and
promote your account to admin.

## Business rules (tunable in `src/lib/constants.ts`)

| Rule | Default |
| --- | --- |
| Timezone | `Europe/Bucharest` |
| Default class capacity | 11 |
| Free-cancellation window | 12 hours before start |
| Max open bookings without a membership | 3 |
| Session generation horizon | 4 weeks |
| Pending-reservation TTL | 10 minutes |

## Architecture notes

- **Booking safety** lives in the database. `book_session` / `cancel_booking` /
  `check_in_booking` are `SECURITY DEFINER` RPCs that take a row lock on the
  session, enforcing capacity, no double-booking, no past sessions, child
  ownership, the no-membership cap, and membership validity — atomically.
- **RLS** restricts every table to the owning client; admins see all via
  `is_admin()`. The admin flag is protected from self-escalation by a trigger.
- **Sessions** are materialized from `weekly_templates` by `generate_sessions()`,
  run on a schedule (pg_cron or the `scheduled` Edge Function) or on demand from
  the admin panel.
- **i18n**: UI strings live in `src/i18n/dictionaries/{ro,ru}.json`; data names
  use `*_ro` / `*_ru` columns. The locale is the first path segment (`/ro`, `/ru`).

## Scripts

- `npm run dev` — dev server
- `npm run build` / `npm start` — production
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — Next lint
