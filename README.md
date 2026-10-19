# SCAMTASTIC

An invite-only, free-to-play social strategy game. SCAMCOINS have no real-world value.

## Run locally

Requires Node.js 20+. Run `npm install`, copy `.env.example` to `.env.local`, add your Supabase URL and publishable key, and run `npm run dev`.

## Deploy

Connect the repository to Vercel with framework preset **Next.js**. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in Vercel (or `NEXT_PUBLIC_SUPABASE_ANON_KEY` for legacy integrations). Do not expose any service role or secret keys.

The application form is intentionally disabled in this first build until bot protection, rate limiting, secure server-side submission and administrator review are implemented. Authentication and the `/game` route use Supabase; only users with an existing non-banned `profiles` row can view the game dashboard. The `/game` middleware refreshes Supabase sessions before server-side authentication checks.

See `docs/ROADMAP.md` for next milestones.
