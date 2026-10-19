# Supabase v0.2.0 migration notes

`migrations/20261019000000_v020_access_admin.sql` is a proposed additive migration. It is deliberately **not** run by the application or this development task. Review it against a staging copy of the existing Supabase project before applying it anywhere.

## Existing schema assumptions

- `public.profiles` already exists, with `id uuid` linked to `auth.users.id` and a text `username`. Existing rows and admin membership are retained. The migration adds profile fields only when missing.
- `public.admin_users` is retained if present. The admin check recognizes a UUID in `user_id`, `profile_id`, `admin_id`, `auth_user_id`, or UUID `id`. Verify which field your project uses and alter `is_scamtastic_admin()` if necessary.
- `public.applications` is reused if present, otherwise created. Its `id` must be a UUID and `status` text. Existing submissions are retained. The migration adds missing application/review fields and indexes.
- Existing `referral_codes`, `referrals`, and `admin_audit_logs` tables must use the fields expected in the migration. Adapt the migration first if the live schema differs. The migration checks for case-insensitive profile username conflicts before adding the `LOWER(username)` unique index; resolve any returned conflicts deliberately rather than deleting records.
- `profiles` table policies are tightened with a restrictive policy and column-level update grants. Review any existing grants, views, triggers, and policies before applying. The application does not read private player rows publicly; public profile data comes from a field-limited database function.
- Profile avatar seeds are random UUIDs (never derived from email), paired with a generator version. The seed is unique and only the authenticated player can reroll it through `reroll_own_avatar()`. Direct API-role updates to the seed or version are not granted. Existing `avatar_url` data is not dropped, but is no longer used or editable by the app.
- The database-backed application endpoint checks username availability, including reserved system names, before accepting a request. `Ampers&` is intentionally not reserved, and the migration does not rename or otherwise alter the existing founder username.

To inspect current tables before adapting, run a read-only query in the Supabase SQL editor:

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in (
    'profiles', 'admin_users', 'applications', 'referral_codes',
    'referrals', 'admin_audit_logs'
  )
order by table_name, ordinal_position;
```

Before applying the migration, inspect and resolve case-insensitive username collisions. The migration will stop rather than choose which existing account to change:

```sql
select lower(username) as normalized_username,
       array_agg(username order by username) as usernames,
       array_agg(id::text order by username) as profile_ids
from public.profiles
where username is not null
group by lower(username)
having count(*) > 1;
```

The migration also checks active application username/email conflicts before creating its partial unique indexes and reserves the system names `admin`, `administrator`, `api`, `apply`, `auth`, `game`, `login`, `logout`, `profile`, `settings`, `support`, and `system` for new applications. Existing usernames are not automatically rewritten. Keep the founder username `Ampers&` unchanged when resolving any conflicts.

Never use `DROP TABLE`, truncate existing data, or replace production tables to make this migration fit. The migration has fail-fast checks for the core profile and application identifiers/status; those checks are not a substitute for review of the full existing schema.

## Founder badge

The migration stores founder status in `public.founder_badges`, keyed by the immutable auth UUID. It does not automatically choose a founder by username or modify `admin_users`. After independently confirming the founder account UUID and existing admin membership, have a database owner execute:

```sql
insert into public.founder_badges(user_id)
values ('<verified-founder-auth-uuid>')
on conflict (user_id) do nothing;
```

The table has no API-role write grants. Do not grant the badge to an account until its UUID is verified.

## Activation email

Application approval records the decision and audit row atomically. The backend generates a one-time Supabase Auth invite link (or a magic link for an existing Auth account) and sends it through Resend. The callback verifies the one-time token, matches the authenticated, verified email to an approved application, and creates the player profile. The activation screen then lets the player set a password. A rejected or pending application cannot be claimed. Existing authenticated profiles are not recreated.

Configure a verified sender/domain in Resend and set the server-only `RESEND_API_KEY` and `EMAIL_FROM` variables. Set `NEXT_PUBLIC_SITE_URL` to the canonical HTTPS origin for the current deployment environment; development and preview senders reject production URLs. Set Supabase Auth's site URL and callback redirect allow-list for production, approved previews, and localhost. See [`../docs/EMAIL-SETUP.md`](../docs/EMAIL-SETUP.md) for DNS, Vercel, SMTP, and redirect setup. Delivery depends on Resend configuration; the dashboard reports failures and supports retry. Retries generate a fresh magic link for an already-created Auth account rather than creating a second account. Do not create an invite by exposing an application ID.

## Applying

1. Verify a fresh backup and staging restore.
2. Inspect the schemas and RLS policies above; adapt any mismatches.
3. Apply the reviewed migration to staging only.
4. Verify RLS, admin authorization, application rate limiting and username conflicts, approval/rejection, email activation, referral attribution, suspensions, last-admin protection, and self-only avatar rerolls.
5. Apply to production only after an explicit deployment/migration approval and a successful staging run.

The migration creates no SCAMCOIN balance, purchase, or reward mechanism.
