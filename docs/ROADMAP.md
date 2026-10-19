# Scamtastic roadmap

## v0.1.0 — First deployment
- Cybersecurity-themed public landing page with interactive animated network
- Login via Supabase email/password
- Protected player dashboard (requires profile and non-banned status)
- Access request placeholder: applications are intentionally not collected until abuse protection and moderation are implemented

## v0.2.0 — Access and administration
- Session-aware navigation, invite application submission, duplicate protection and rate limiting
- Server-checked administration, application review, Supabase Auth activation, player moderation and audit views
- Referral code creation, attribution and revocation
- Public profiles, account settings and founder badge storage
- Requires reviewed Supabase schema migration and environment/email setup before deployment

## v0.3.0 — Neural network
- Persistent procedurally placed nodes for active player profiles and a manual idempotent backfill
- Public-safe, paginated network and search RPCs; server-authorized, idempotent gameplay relationship recording
- Interactive Three.js public landing page, `/network` viewer, and responsive profile-network scenes
- Gameplay features must explicitly emit eligible interactions before relationships appear

## v0.4.0 — Invitations, network identity, and social foundations
- Credit-backed player invitations remain subject to administrator application review; verified administrators can issue expiring, email-bound direct authorizations
- Player credit requests, admin invitation/credit management, secure invitation landing and account activation
- Bounded administrator email composer with sanitized templates, server-side delivery, and minimal history metadata
- Render-only Scamtastic system neuron, centralized rendering palette, and invitation-origin neural relationships
- Requires reviewing and applying `supabase/migrations/20261019020000_v040_invitations.sql` to development before deploying the application
- Role-aware public landing page and Network Command Center with live profile, invitation, follow, and network metrics
- Directional player following, public follower/following lists, and a bounded recent feed of eligible public gameplay events
- Searchable, paginated admin player directory with individual player management
- Requires reviewing and applying the social migrations to development; see `docs/SOCIAL-FOUNDATIONS.md`

## Future — Bits placeholder
- Bits remain a fictional placeholder. No balances, transactions, purchases, redemptions, earnings, or financial leaderboard are implemented.

## Later
- Node-based software studio and virtual OS
- Fictional security challenges (never real malware)
- Android app

All approved players play for free. Bits have no real-world value. Donations provide no gameplay benefits.
