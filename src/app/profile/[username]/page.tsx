import Link from 'next/link';
import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import ProceduralAvatar from '@/components/ProceduralAvatar';
import ProfileNeuralCanvas from '@/components/profile/ProfileNeuralCanvas';
import ProfileFollowControls from '@/components/profile/ProfileFollowControls';
import { parsePublicFollowData } from '@/lib/profile-follows.mjs';
import { profileUsernameFromRouteParam } from '@/lib/profile-route.mjs';
import { authenticatedUser } from '@/lib/server';
import { parsePublicNeuralProfile, type NeuralSearchResult } from '@/lib/neural/types';

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const routeParams = await params;
  const username = profileUsernameFromRouteParam(routeParams.username);
  if (!username) notFound();

  const { db, user } = await authenticatedUser();
  const { data, error } = await db.rpc('public_neural_profile', {
    p_username: username,
    p_limit: 100,
  });
  if (error) throw error;
  const profile = parsePublicNeuralProfile(data);
  if (!profile) notFound();

  const { data: followDataResult, error: followDataError } = await db.rpc(
    'public_player_follow_data',
    { p_username: profile.profile.username },
  );
  if (followDataError) throw followDataError;
  const followData = parsePublicFollowData(followDataResult);
  if (!followData) throw new Error('Public follow data returned an invalid shape');

  let isOwner = false;
  if (user) {
    const { data: ownProfile, error: ownProfileError } = await db
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle();
    if (ownProfileError) throw ownProfileError;
    isOwner =
      ownProfile?.username?.toLowerCase() === profile.profile.username.toLowerCase();
  }

  const visibleNodes: NeuralSearchResult[] = [];
  const nodeIds = new Set<string>();
  if (profile.node) {
    visibleNodes.push({
      id: profile.playerId,
      username: profile.profile.username,
      displayName: profile.profile.display_name,
      avatarSeed: profile.profile.avatar_seed,
      avatarVersion: profile.profile.avatar_generator_version,
      x: profile.node.x,
      y: profile.node.y,
      z: profile.node.z,
    });
    nodeIds.add(profile.playerId);
    for (const connection of profile.connections) {
      if (!nodeIds.has(connection.player.id)) {
        visibleNodes.push(connection.player);
        nodeIds.add(connection.player.id);
      }
    }
  }
  const visibleConnections = profile.connections.filter(
    (connection) =>
      nodeIds.has(connection.playerA) && nodeIds.has(connection.playerB),
  );

  return (
    <>
      <Header />
      <main className="profileExperience">
        {profile.node ? (
          <ProfileNeuralCanvas
            nodes={visibleNodes}
            connections={visibleConnections}
            playerId={profile.playerId}
            username={profile.profile.username}
            avatarSeed={profile.profile.avatar_seed}
            avatarVersion={profile.profile.avatar_generator_version}
            maxStrength={profile.maxStrength}
          />
        ) : (
          <div className="profileNeuronPending" role="status">
            This player’s neuron is being prepared.
          </div>
        )}
        <div className="profileNetworkShade" aria-hidden="true" />
        <section className="profileComposition">
          <div className="profileThird">
            <div className="profileIdentity">
              <div className="profileIdentityText">
                <h1>{profile.profile.username}</h1>
                <span className="profileIdentityLine" aria-hidden="true" />
                <p>@{profile.profile.username}</p>
              </div>
              <div className="profileAvatarFrame">
                <ProceduralAvatar
                  className="profileAvatar"
                  seed={profile.profile.avatar_seed}
                  version={profile.profile.avatar_generator_version}
                  label={`${profile.profile.username} avatar`}
                />
              </div>
            </div>

            <article className="profileInformationPanel">
              <div className="tag">// PLAYER PROFILE</div>
              <h2>{profile.profile.display_name || profile.profile.username}</h2>
              <div className="badgeGroup profileBadges">
                {profile.profile.is_founder && (
                  <span className="statusBadge approved">Founder</span>
                )}
                {profile.profile.is_admin && (
                  <span className="statusBadge">Administrator</span>
                )}
              </div>
              <ProfileFollowControls
                username={profile.profile.username}
                viewerIsAuthenticated={Boolean(user)}
                isOwner={isOwner}
                initialData={followData}
              />
              <section className="profileBioSection" aria-labelledby="profile-bio-heading">
                <h3 id="profile-bio-heading">// BIO</h3>
                {profile.profile.bio ? (
                  <p className="profileBiography">{profile.profile.bio}</p>
                ) : (
                  <p className="profileBiographyEmpty">No public bio yet.</p>
                )}
              </section>
              <section className="profileStatistics" aria-labelledby="profile-stats-heading">
                <h3 id="profile-stats-heading">// NETWORK RECORD</h3>
                <dl>
                  <div>
                    <dt>Connections</dt>
                    <dd>{profile.connectionCount}</dd>
                  </div>
                  <div>
                    <dt>Interactions</dt>
                    <dd>{profile.interactionCount}</dd>
                  </div>
                  <div>
                    <dt>Joined</dt>
                    <dd>
                      <time dateTime={profile.profile.created_at}>
                        {new Date(profile.profile.created_at).toLocaleDateString()}
                      </time>
                    </dd>
                  </div>
                </dl>
              </section>
              {isOwner && (
                <Link className="button secondary profileEdit" href="/settings">
                  Edit Profile
                </Link>
              )}
              {profile.hasMoreConnections && (
                <p className="profileConnectionsNote">
                  Showing the 100 strongest connections.
                </p>
              )}
            </article>
          </div>
          <p className="profileSceneHint">
            Drag to orbit · pinch to pan and zoom · select a connected neuron to view that player
          </p>
        </section>
      </main>
    </>
  );
}
