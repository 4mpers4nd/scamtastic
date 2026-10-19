# Social foundations rollout

The social migrations add directional follows and a read-only feed over existing gameplay-event data. The application does not apply database migrations automatically.

## Development-only migration steps

Apply these migrations to the **`scamtastic_development` Supabase project only**, in order:

1. Confirm the project reference in the Supabase dashboard and make a development backup. Do not use production credentials.
2. Confirm the existing v0.2, v0.3, and v0.4 migrations have been reviewed and applied to this development project:
   - `supabase/migrations/20261019000000_v020_access_admin.sql`
   - `supabase/migrations/20261019010000_v030_neural_network.sql`
   - `supabase/migrations/20261019020000_v040_invitations.sql`
3. Review and run the complete [`20261019030000_v041_social_follows.sql`](../supabase/migrations/20261019030000_v041_social_follows.sql) migration once in the development project's SQL Editor or the normal reviewed migration pipeline.
4. Review and run the complete [`20261019040000_v042_followed_activity_feed.sql`](../supabase/migrations/20261019040000_v042_followed_activity_feed.sql) migration once, after v0.3 and v0.4 are present.
5. Verify the table has RLS enabled and no direct privileges for `anon` or `authenticated`. Test follows as an active player, and confirm self-follow, banned accounts, and missing profiles are rejected. Repeating follow/unfollow requests should not create duplicate relationships.
6. Verify that public follow data contains only active-player usernames and display names, with at most 20 list entries per direction. Confirm the activity function returns no more than 50 items from the previous 30 days and excludes invitation and transaction event types.
7. Validate `/profile/[username]`, `/activity`, `/`, and `/dashboard` in a development deployment. Keep production migration and deployment separate pending independent review and approval.

Neither migration has been applied by this code change. Do not paste invitation codes, user emails, or secrets into SQL.

## Data boundaries

- `player_follows` is directional: `follower_id` follows `followed_id`. It has no writes to neural nodes, neural connections, interaction counts, or invitation/reward data.
- RLS is enabled and table access is revoked from client roles. Mutations are only available through authenticated RPCs that validate active profiles and prohibit self-follows. Public profile follow data is read through a bounded RPC.
- The feed is personalized to the authenticated player's current follows. It returns only usernames, display names, timestamps, and a whitelist of opportunity participation, project collaboration, and multiplayer activity. It does not return event source IDs, emails, application data, invitation activity, or transaction activity.
- Feed entries are sourced from existing `neural_interaction_events`; the feed does not write events or create neural connections. It may remain empty until trusted gameplay features emit eligible activity.
- The dashboard uses existing profile, invitation, follow, and neural data. Bits and opportunities are display-only placeholders; no balance, transaction, or earnings system is introduced.

Prefer rolling back application code while retaining these additive database objects. Do not drop follow records or migration objects without a separately reviewed backup and rollback plan.
