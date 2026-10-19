import Link from 'next/link';
import Header from '@/components/Header';
import ProceduralAvatar from '@/components/ProceduralAvatar';
import FollowingActivityFeed from '@/components/activity/FollowingActivityFeed';
import { parsePublicFollowData } from '@/lib/profile-follows.mjs';
import { profileHref } from '@/lib/profile-route.mjs';
import { parsePublicNeuralProfile } from '@/lib/neural/types';
import { supabaseServer } from '@/lib/server';

type DashboardProfile = {
  username: string;
  display_name: string | null;
  avatar_seed: string | null;
  avatar_generator_version: number | null;
};

type InvitationStats = {
  available: number;
  total: number;
  successful: number;
};

function isNonnegativeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function parseInvitationStats(value: unknown): InvitationStats | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const stats = value as Record<string, unknown>;
  if (
    !isNonnegativeCount(stats.available) ||
    !isNonnegativeCount(stats.total) ||
    !isNonnegativeCount(stats.successful)
  ) {
    return null;
  }
  return {
    available: stats.available,
    total: stats.total,
    successful: stats.successful,
  };
}

export default async function PlayerCommandCenter({
  profile,
}: {
  profile: DashboardProfile;
}) {
  const db = await supabaseServer();
  const [invitationResult, followResult, networkResult] = await Promise.all([
    db.rpc('my_invitation_dashboard'),
    db.rpc('public_player_follow_data', { p_username: profile.username }),
    db.rpc('public_neural_profile', { p_username: profile.username, p_limit: 1 }),
  ]);
  if (invitationResult.error) throw invitationResult.error;
  if (followResult.error) throw followResult.error;
  if (networkResult.error) throw networkResult.error;

  const invitationStats = parseInvitationStats(invitationResult.data);
  const followStats = parsePublicFollowData(followResult.data);
  const networkStats = parsePublicNeuralProfile(networkResult.data);
  if (!invitationStats || !followStats || !networkStats) {
    throw new Error('Player command center data returned an invalid shape');
  }

  const displayName = profile.display_name || profile.username;
  const profileLink = profileHref(profile.username);

  return (
    <>
      <Header />
      <main className="commandCenter">
        <div className="commandCenterHeading">
          <div className="tag">// NETWORK COMMAND CENTER</div>
          <h1>Welcome, {displayName}.</h1>
          <p>Your profile, social network, and invitation activity at a glance.</p>
        </div>
        <section className="commandStats" aria-label="Player overview">
          <article className="card commandProfileCard">
            <div className="commandCardTop">
              {profile.avatar_seed && profile.avatar_generator_version ? (
                <ProceduralAvatar
                  className="commandAvatar"
                  seed={profile.avatar_seed}
                  version={profile.avatar_generator_version}
                  label={`${profile.username} avatar`}
                />
              ) : (
                <span className="commandAvatar commandAvatarFallback" aria-hidden="true">
                  {profile.username.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <h2>{displayName}</h2>
                <p>@{profile.username}</p>
              </div>
            </div>
            <Link className="button secondary" href={profileLink}>View profile</Link>
          </article>

          <article className="card commandStatCard">
            <div className="tag">// NEURAL NETWORK</div>
            <dl>
              <div><dt>Connections</dt><dd>{networkStats.connectionCount}</dd></div>
              <div><dt>Interactions</dt><dd>{networkStats.interactionCount}</dd></div>
            </dl>
            <Link href="/network">Explore the network →</Link>
          </article>

          <article className="card commandStatCard">
            <div className="tag">// SOCIAL NETWORK</div>
            <dl>
              <div><dt>Followers</dt><dd>{followStats.followersCount}</dd></div>
              <div><dt>Following</dt><dd>{followStats.followingCount}</dd></div>
            </dl>
            <Link href={profileLink}>View your profile →</Link>
          </article>

          <article className="card commandStatCard">
            <div className="tag">// INVITES</div>
            <dl>
              <div><dt>Available</dt><dd>{invitationStats.available}</dd></div>
              <div><dt>Sent</dt><dd>{invitationStats.total}</dd></div>
              <div><dt>Successful</dt><dd>{invitationStats.successful}</dd></div>
            </dl>
            <Link href="/settings/invitations">Manage invites →</Link>
          </article>

          <article className="card commandPlaceholderCard">
            <div className="tag">// BITS</div>
            <h2>Coming soon</h2>
            <p>No balances, transactions, or earnings are available yet.</p>
          </article>

          <article className="card commandPlaceholderCard">
            <div className="tag">// OPPORTUNITIES</div>
            <h2>Coming soon</h2>
            <p>There are no active opportunities to show.</p>
          </article>
        </section>
        <FollowingActivityFeed />
      </main>
    </>
  );
}
