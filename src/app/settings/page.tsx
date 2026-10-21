import { redirect } from 'next/navigation';
import Link from 'next/link';
import { OwnProfileForm } from '@/components/AdminActionForms';
import AvatarReroll from '@/components/AvatarReroll';
import Header from '@/components/Header';
import { getAccessDecision } from '@/lib/auth-state.mjs';
import { authenticatedUser } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Settings() {
  const { db, user } = await authenticatedUser();
  if (getAccessDecision(user) === 'login') redirect('/login');
  const player = user ?? redirect('/login');

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('username,display_name,bio,avatar_seed,avatar_generator_version,is_banned')
    .eq('id', player.id)
    .maybeSingle();
  if (profileError) throw profileError;

  return (
    <>
      <Header />
      <main className="formWrap settingsWrap">
        <div className="settingsGrid">
          <div>
            <div className="tag">// ACCOUNT SETTINGS</div>
            <h1>Keep your profile current.</h1>
            <p className="muted">
              Signed in as {profile?.username ?? player.email}. Your username and
              account credentials are managed separately.
            </p>
            {profile ? (
              <>
                <OwnProfileForm
                  displayName={profile.display_name}
                  bio={profile.bio}
                />
                {profile.avatar_seed && profile.avatar_generator_version && (
                  <section className="adminPanel">
                    <div className="tag">// YOUR AVATAR</div>
                    <h2>Distinctive by design.</h2>
                    {profile.is_banned ? (
                      <p className="muted">
                        Avatar rerolls are unavailable while your account is suspended.
                      </p>
                    ) : (
                      <AvatarReroll
                        initialSeed={profile.avatar_seed}
                        initialVersion={profile.avatar_generator_version}
                        username={profile.username}
                      />
                    )}
                  </section>
                )}
              </>
            ) : (
              <section className="adminPanel">
                <h2>Player profile unavailable</h2>
                <p>Your account does not yet have an approved player profile.</p>
              </section>
            )}
          </div>
          <section className="adminPanel">
            <div className="tag">// INVITE NETWORK</div>
            <h2>Bring someone into the network.</h2>
            <p>Review your available invites and manage invitations you have sent.</p>
            <Link className="button secondary" href="/settings/invitations">Manage invites</Link>
          </section>
        </div>
      </main>
    </>
  );
}
