# Scamtastic v0.4.0 — invitations and administration

## Development database rollout

The v0.4 migration is additive and intentionally has not been applied by this change.
Apply it only to the **development** Supabase project first:

1. Confirm the Supabase dashboard project reference is the development project; do not use production credentials.
2. Review `supabase/migrations/20261019020000_v040_invitations.sql`.
3. Back up the development database, then run the complete migration once in the development project's SQL Editor or through the project's normal reviewed migration pipeline.
4. Verify that existing profiles received five credits, existing invitation balances were not reset, and the `Ampers&` neural node moved while retaining its player ID and connections.
5. Test an invited application through rejection, approval, and activation; test admin invitation expiry, revocation, email mismatch, and successful activation.
6. Deploy the application only after the development migration and verification succeed. Promote the migration to production separately after review and approval.

Do not manually insert application tokens or copy invitation codes into SQL. The application creates random 256-bit invitation codes and stores only their SHA-256 hashes. The migration does not create Auth users, reset existing player records, or create a system-neuron database row.

## Player invitation flow

- `/settings/invitations` shows a player's available credits, invitation state, outcomes, and credit requests.
- Each generated invitation consumes one credit and is valid for 30 days.
- An unused invitation can be revoked or expire; either action returns its credit once.
- An invited applicant is attached to the existing application review flow. Player invitations never approve or activate an account.
- A rejected invited application returns its credit. Once activated, the credit remains consumed and the inviter is connected to the new player with a unique invitation-origin interaction event.
- Additional-credit requests allow 1–20 credits, one request per player per seven days, and only one pending request at a time.

## Administrator invitation and email flows

- `/admin/invitations` requires an authenticated administrator with a verified email. Administrator invitations are bound to their entered email, expire after a configured 1–90 days, and are single-use and revocable.
- The invitation callback verifies the Supabase Auth token, then the claim RPC checks the verified session email against the invitation. Profile creation, token consumption, and the initial five credits happen transactionally. Admin invitations do not create a player-to-player connection.
- `/admin/email` supports up to ten selected active players or custom addresses per send. Sending is rate-limited to five sends per administrator per hour. HTML is allow-listed and links are limited to HTTP(S) and `mailto:`; delivery history intentionally omits recipients and message bodies.
- Resend credentials remain server-only. Use the environment-specific `NEXT_PUBLIC_SITE_URL` described in [EMAIL-SETUP.md](./EMAIL-SETUP.md); preview and local safety checks continue to reject production destinations.

## Network rendering

The renderer uses the existing header's Scamtastic `S` mark as its system-neuron sprite; the repository does not contain a separate logo image asset. The system neuron exists only in the renderer at `(0, 0, 0)`, is excluded from player API data and gameplay, and opens a dedicated identity panel. The migration moves the existing `Ampers&` node in place using the existing procedural placement algorithm, preserving its node identity and all edges.

The `prefers-reduced-motion` setting disables system-neuron pulsing and orbit animation. Background and player/system colors are centralized in `src/lib/neural/rendering.mjs` and `src/app/v040.css`.
