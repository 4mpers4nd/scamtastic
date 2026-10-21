import Link from 'next/link';
import { authenticatedUser } from '@/lib/server';
import { profileHref } from '@/lib/profile-route.mjs';
import { parseFollowedActivity, type FollowedActivityItem } from '@/lib/followed-activity.mjs';

const activityLabels: Record<FollowedActivityItem['activityType'], string> = {
  'gameplay.opportunity_participation': 'Joined an opportunity',
  'gameplay.project_collaboration': 'Collaborated on a project',
  'gameplay.multiplayer_activity': 'Played together',
};

function PlayerLink({ player }: { player: FollowedActivityItem['playerA'] }) {
  return (
    <Link href={profileHref(player.username)}>
      {player.displayName || `@${player.username}`}
    </Link>
  );
}

export default async function FollowingActivityFeed() {
  const { db, user } = await authenticatedUser();
  if (!user) {
    return (
      <section className="adminPanel">
        <h2>Sign in to see your activity feed</h2>
        <Link className="button secondary" href="/login">Sign in</Link>
      </section>
    );
  }

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('is_banned')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile || profile.is_banned) {
    return (
      <section className="adminPanel">
        <h2>Player access required</h2>
        <p className="muted">The activity feed is available to active players.</p>
      </section>
    );
  }

  const { data, error } = await db.rpc('followed_player_activity', { p_limit: 50 });
  if (error) throw error;
  const items = parseFollowedActivity(data);
  if (!items) throw new Error('Followed activity returned an invalid shape');

  return (
    <section className="followingActivityFeed" aria-labelledby="following-activity-heading">
      <div className="panelHeading">
        <div>
          <div className="tag">// YOUR NETWORK</div>
          <h2 id="following-activity-heading">Recent activity</h2>
        </div>
        <span className="muted">Last 30 days · newest first</span>
      </div>
      {items.length === 0 ? (
        <div className="adminPanel">
          <h3>No recent activity</h3>
          <p className="muted">
            This feed only includes eligible public gameplay moments from players you follow.
            It can be empty when no matching activity has occurred in the last 30 days.
          </p>
          <Link className="button secondary" href="/network">Explore the network</Link>
        </div>
      ) : (
        <ol className="activityFeedList">
          {items.map((item) => (
            <li
              className="adminPanel activityFeedItem"
              key={`${item.occurredAt}:${item.activityType}:${item.playerA.username}:${item.playerB.username}`}
            >
              <p>
                <strong>{activityLabels[item.activityType]}</strong>
                <span> · </span>
                <PlayerLink player={item.playerA} />
                <span> and </span>
                <PlayerLink player={item.playerB} />
              </p>
              <time dateTime={item.occurredAt}>{new Date(item.occurredAt).toLocaleString()}</time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
