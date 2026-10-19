# Neural network v0.3.0

The network displays only active profiles and recorded, eligible player-to-player gameplay relationships. It does not generate decorative players or links. The home page and `/network` viewer use the paginated public snapshot API; public profiles show the selected player's real node and up to 100 strongest direct relationships.

## Database rollout

No migration is run by the application. Test the existing production-compatible schema on a staging copy before applying SQL manually.

1. Back up the target database and inspect the existing `public.profiles` definition and policies.
2. Apply or adapt the reviewed v0.2.0 migration first. The neural migration requires `profiles.id` (UUID), `username`, `is_banned`, `avatar_seed`, `avatar_generator_version`, plus the v0.2.0 `public_profile(text)` function and referral tables.
3. Review and manually apply [`../supabase/migrations/20261019010000_v030_neural_network.sql`](../supabase/migrations/20261019010000_v030_neural_network.sql). It creates only neural-network tables/functions and a profile-insert/reactivation trigger. It does not modify authentication, admin membership, application records, or existing profile rows.
4. Run the idempotent backfill as the database owner in the SQL editor or through a trusted service-role administrative operation:

   ```sql
   select public.backfill_neural_nodes();
   ```

   The result contains `created` and `failed` counts. A failed placement is logged as a database warning and can be retried by running the backfill again. The backfill includes every existing non-banned profile, including the founder if that profile is active. It does not create relationships.
5. Verify the backfill and coordinate uniqueness:

   ```sql
   select
     (select count(*) from public.profiles where not is_banned) as active_players,
     (select count(*) from public.neural_nodes n
       join public.profiles p on p.id = n.player_id
       where not p.is_banned) as active_nodes,
     (select count(*) from public.neural_connections) as relationships;

   select player_id, count(*)
   from public.neural_nodes
   group by player_id
   having count(*) <> 1;
   ```

   After a successful backfill, `active_players` and `active_nodes` should match, the second query should return no rows, and `relationships` should remain zero until an eligible gameplay event is recorded.
6. Check public access as both `anon` and `authenticated`: the four neural tables have RLS enabled and no client policies or direct grants. Read public data only through `public_neural_snapshot`, `public_neural_search`, and `public_neural_profile`. These functions expose usernames, display names, bios, procedural avatar inputs, positions, referral totals, and relationship totals—not emails, application answers, audit logs, or auth metadata.

The active strength cap defaults to 20 and can be adjusted by the database owner without a schema change:

```sql
update public.neural_network_config
set max_strength = 25
where singleton;
```

The cap is constrained to 1–100 and returned with network/profile data so the renderer follows the configured value. `interaction_count` keeps increasing after visual strength reaches the cap. Raising the cap allows existing relationships to grow again; lowering it never decreases already-recorded strength.

## Tables and write boundaries

- `neural_nodes` has one primary-key row per profile, a persisted 3D position, and a creation timestamp. Node placement is serialized with a transaction advisory lock, samples around an existing cluster, rejects candidates that are too close or too distant, and uses a unique player key for race-safe idempotency.
- `neural_connections` has a canonical `(player_a, player_b)` primary key, positive strength/count constraints, and cascading node foreign keys.
- `neural_interaction_events` stores source-event IDs permanently for idempotency and a strict allowlist of gameplay event types. No administrative event type is eligible.
- `neural_network_config` stores the configurable visual-strength cap.

`record_neural_interaction` is executable only by `service_role`. The server-only `recordNeuralInteraction` helper is the integration point for future trusted gameplay operations; there is deliberately no client-facing interaction endpoint. Its SQL operation writes the deduplication row and atomically increments/creates the relationship in one transaction. Replaying a source event returns `false` without changing counts. It rejects self-links, inactive/banned players, and event types outside the allowlist.

No gameplay feature in the current application emits eligible events, so the initial network correctly has nodes but no edges. Do not call the service helper for application approvals, admin actions, profile edits, referrals, or maintenance.

Event rows are retained indefinitely because they enforce duplicate prevention. If volume later requires retention, archive event IDs or establish a bounded idempotency horizon before deleting rows; deleting them without a deduplication strategy could allow replayed events to strengthen a relationship twice.

## API and rendering

- `GET /api/network?limit=150&offset=0` returns a bounded node page and up to 2,000 adjacent real connections. The database caps page sizes and edge limits. The viewer can request subsequent pages.
- `GET /api/network/search?q=...` performs a bounded username-prefix search; it does not download the player directory.
- `GET /api/network/profile/[username]` returns only the public profile and bounded direct-connection details.
- Public API responses use a short shared cache lifetime; clients refresh explicitly. No unbounded Realtime channel is opened.
- Three.js renders nodes and connections as instanced meshes. Desktop orbit/pan/zoom, keyboard free flight, pointer/touch gestures, direct selection, search, and profile focus use the actual returned node IDs. The profile scene uses the same procedural avatar tile generator as the profile image.
- Reduced-motion preferences disable automatic camera orbit. WebGL failures and unavailable network data have UI fallbacks.

## Manual validation and rollback

Run the project test suite, `npx tsc --noEmit`, and `npm run build` before rollout. Verify `/`, `/network`, and profiles including `/profile/Ampers%26` in a staging deployment. Test a new approved activation, idempotent backfill, owner-only profile editing, anonymous profile visibility, and direct table access under both client roles.

The migration is transactional, but dropping its tables would permanently remove node positions, relationships, and event deduplication history. Prefer rolling back application code while keeping the additive schema. If a full database rollback is unavoidable, take a verified backup, coordinate a maintenance window, and have the database owner review dependency order and data-retention implications before dropping any objects.
