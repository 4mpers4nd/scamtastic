import Link from 'next/link';
import Header from '@/components/Header';
import Network from '@/components/Network';
import FollowingActivityFeed from '@/components/activity/FollowingActivityFeed';
import { profileHref } from '@/lib/profile-route.mjs';
import type { parseNetworkDashboard } from '@/lib/network-dashboard.mjs';

type NetworkDashboardData = NonNullable<ReturnType<typeof parseNetworkDashboard>>;

function Leaderboard({
  title,
  entries,
}: {
  title: string;
  entries: NetworkDashboardData['mostConnected'];
}) {
  return (
    <section className="networkLeaderboard" aria-label={title}>
      <h3>{title}</h3>
      {entries.length > 0 ? (
        <ol>
          {entries.map((entry) => (
            <li key={entry.username}>
              <Link href={profileHref(entry.username)}>
                {entry.displayName || `@${entry.username}`}
              </Link>
              <strong>{entry.value}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">No network activity yet.</p>
      )}
    </section>
  );
}

export default function NetworkCommandCenter({
  data,
}: {
  data: NetworkDashboardData;
}) {
  return (
    <>
      <Header />
      <main className="networkCommandCenter">
        <section className="globalNetworkHero" aria-labelledby="global-network-heading">
          <div className="globalNetworkVisualization">
            <Network />
          </div>
          <div className="globalNetworkContent">
            <div className="tag">// SCAMTASTIC NETWORK</div>
            <h1 id="global-network-heading">The global network.</h1>
            <p>Explore the players and connections that make up Scamtastic.</p>
            <Link className="button secondary" href="/network">Explore network</Link>
          </div>
          <div className="globalNetworkMetrics" aria-label="Global network statistics">
            <div><span>Players</span><strong>{data.playerCount}</strong></div>
            <div><span>Connections</span><strong>{data.connectionCount}</strong></div>
            <div><span>Interactions</span><strong>{data.interactionCount}</strong></div>
          </div>
        </section>
        <section className="networkLeaderboardGrid" aria-label="Network leaderboards">
          <Leaderboard title="Most connected" entries={data.mostConnected} />
          <Leaderboard title="Most network interactions" entries={data.mostInteractions} />
        </section>
        <FollowingActivityFeed />
      </main>
    </>
  );
}
