import { notFound } from 'next/navigation';
import Header from '@/components/Header';
import ProceduralAvatar from '@/components/ProceduralAvatar';
import { supabaseServer } from '@/lib/server';

type PublicProfile = {
  username: string;
  display_name: string | null;
  bio: string;
  avatar_seed: string;
  avatar_generator_version: number;
  created_at: string;
  is_founder: boolean;
  is_admin: boolean;
  referral_count: number;
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const db = await supabaseServer();
  const { data, error } = await db.rpc('public_profile', { p_username: username });
  if (error) throw error;
  if (!data) notFound();
  const profile = data as PublicProfile;

  return (
    <>
      <Header />
      <main className="formWrap">
        <article className="publicProfile">
          <ProceduralAvatar
            className="profileAvatar"
            seed={profile.avatar_seed}
            version={profile.avatar_generator_version}
            label={`${profile.username} avatar`}
          />
          <div className="tag">// PLAYER PROFILE</div>
          <h1>{profile.display_name || profile.username}</h1>
          <p className="profileUsername">@{profile.username}</p>
          <div className="badgeGroup">
            {profile.is_founder && <span className="statusBadge approved">Founder</span>}
            {profile.is_admin && <span className="statusBadge">Administrator</span>}
          </div>
          <p className="profileBio">{profile.bio || 'No public bio yet.'}</p>
          <dl className="detailList">
            <div>
              <dt>Joined</dt>
              <dd>
                <time dateTime={profile.created_at}>
                  {new Date(profile.created_at).toLocaleDateString()}
                </time>
              </dd>
            </div>
            <div><dt>Referrals</dt><dd>{profile.referral_count}</dd></div>
          </dl>
        </article>
      </main>
    </>
  );
}
