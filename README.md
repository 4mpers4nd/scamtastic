# SCAMTASTIC v0.3.0

An invite-only, free-to-play social strategy game. SCAMCOINS have no real-world value.

## Run locally

Requires Node.js 20+. Run `npm install`, copy `.env.example` to `.env.local`, configure the Supabase values, then run `npm run dev`.

## Deploy

Connect the repository to the existing Vercel project with framework preset **Next.js**. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY` for legacy projects), and `NEXT_PUBLIC_SITE_URL`. Set `SUPABASE_SERVICE_ROLE_KEY` and `APPLICATION_RATE_LIMIT_SECRET` as server-only environment variables. Never use a `NEXT_PUBLIC_` prefix for secrets.

## v0.2.0 access and administration

- Session-aware account navigation with accessible sign-out and admin entry.
- Public access applications with server-side validation, duplicate protection, referral attribution, and per-IP rate limiting.
- `/admin` workflows for reviewing applications, inviting approved applicants through Supabase Auth email links, player moderation, referral codes, and append-only audit views.
- `/settings` for profile preferences and referral management; `/profile/[username]` for public profiles.
- `/game` and `/admin` are checked server-side. Only authenticated players with a non-banned profile may use the game.

## v0.3.0 — Neural network

- The home page now renders real player neurons and eligible gameplay relationships instead of a decorative placeholder graph.
- `/network` provides a paginated 3D viewer with orbit/free-flight controls, bounded username search, player inspection, and profile navigation.
- Public profiles combine the existing procedural avatar and badges with a responsive, interactive network scene and actual referral/connection/interaction totals.
- Neuron positions and idempotent relationship events use a separate, restrictive Supabase schema. New profiles are placed automatically, and existing active profiles require a manual, retryable backfill.
- Review and manually apply [`supabase/migrations/20261019010000_v030_neural_network.sql`](./supabase/migrations/20261019010000_v030_neural_network.sql) only after staging validation. See [`docs/NEURAL-NETWORK.md`](./docs/NEURAL-NETWORK.md) for migration order, backfill, access checks, and rollback guidance.

The current game does not yet emit eligible player-to-player events. Until a trusted gameplay feature registers them, the graph intentionally contains no relationship edges.

### Supabase setup

1. Inspect the existing `profiles`, `admin_users`, and `applications` tables and RLS policies.
2. Review and manually apply [`supabase/migrations/20261019000000_v020_access_admin.sql`](./supabase/migrations/20261019000000_v020_access_admin.sql) to the intended project. It is additive and fail-fast, but has not been run against production. Do not deploy until it succeeds against a staging copy first.
3. The migration expects `profiles.id` to be a UUID and `profiles.username` to be text; if an `applications` table already exists, it expects UUID `id` and text `status`. Existing `admin_users` rows should identify the auth user using `user_id`, `profile_id`, `admin_id`, `auth_user_id`, or UUID `id`. Adapt the migration to the inspected schema if needed; it will not replace existing tables.
4. After confirming the intended founder's Supabase Auth UUID independently and confirming the matching existing admin record, insert that UUID into `public.founder_badges` using the SQL editor as the database owner. The migration intentionally does not guess a founder identity from a username or change admin membership.
5. Follow [`docs/EMAIL-SETUP.md`](./docs/EMAIL-SETUP.md) to configure environment-scoped Vercel URLs, Resend DNS, Supabase SMTP, and Auth redirects. Locally, use `http://localhost:3000`; preview deployments refuse the production hostname.
6. Supabase Auth generates one-time invite or magic-link tokens; Resend sends the activation email, and Supabase enforces token expiry and replay protection. If delivery is not configured, approval is recorded but the UI reports the failure and allows an administrator to retry without creating another account.

Player avatars are deterministic geometric SVGs generated from a random profile seed and a stored generator version; no avatar images are uploaded or stored. Players can reroll their own avatar in settings. Passwords are handled only by Supabase Auth. SCAMCOINS cannot be bought, sold, redeemed, or exchanged for real money.

No production migration or deployment has been run as part of this code change.

See `docs/ROADMAP.md` for next milestones.
