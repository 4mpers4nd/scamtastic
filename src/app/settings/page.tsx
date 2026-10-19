import { redirect } from 'next/navigation';
import { OwnProfileForm, OwnReferralForm, OwnReferralRevokeForm } from '@/components/AdminActionForms';
import AvatarReroll from '@/components/AvatarReroll';
import CopyReferralLink from '@/components/CopyReferralLink';
import Header from '@/components/Header';
import { getAccessDecision } from '@/lib/auth-state.mjs';
import { authenticatedUser } from '@/lib/server';

type ReferralCode = {
  id: string;
  code: string;
  usage_limit: number;
  uses: number;
  revoked_at: string | null;
  created_at: string;
};

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

  let referrals: ReferralCode[] = [];
  if (profile && !profile.is_banned) {
    const { data: referralData, error: referralError } = await db.rpc('my_referral_codes');
    if (referralError) throw referralError;
    referrals = (referralData ?? []) as ReferralCode[];
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

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
            <h2>Your referral codes</h2>
            <p>Codes are limited, revocable, and do not approve an application.</p>
            {profile && !profile.is_banned && <OwnReferralForm />}
            {referrals.length === 0 ? (
              <p className="emptyState">No referral codes created.</p>
            ) : (
              <div className="referralList">
                {referrals.map((referral) => {
                  const link = `${siteUrl}/apply?ref=${encodeURIComponent(referral.code)}`;
                  return (
                    <article className="referralItem" key={referral.id}>
                      <div>
                        <code>{referral.code}</code>
                        <span>{referral.uses} / {referral.usage_limit} uses</span>
                        {referral.revoked_at && <span className="error">Revoked</span>}
                      </div>
                      {!referral.revoked_at && <CopyReferralLink href={link} />}
                      {!referral.revoked_at && <OwnReferralRevokeForm id={referral.id} />}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
