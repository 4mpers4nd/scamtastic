import Link from 'next/link';
import { notFound } from 'next/navigation';
import AdminInvitationClaimForm from '@/components/AdminInvitationClaimForm';
import Header from '@/components/Header';
import ProceduralAvatar from '@/components/ProceduralAvatar';
import { invitationCodeHash, isInvitationCode } from '@/lib/invitation-code.mjs';
import { authenticatedUser } from '@/lib/server';

type Preview = {
  kind: 'player' | 'admin';
  status: string;
  expires_at: string;
  inviter?: {
    username: string;
    display_name: string | null;
    avatar_seed: string;
    avatar_version: number;
  };
};

export const dynamic = 'force-dynamic';

export default async function InvitationLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!isInvitationCode(code)) notFound();
  const { db, user } = await authenticatedUser();
  const { data, error } = await db.rpc('invitation_preview', {
    p_code_hash: invitationCodeHash(code),
  });
  if (error) throw error;
  if (!data) notFound();
  const preview = data as Preview;

  let ownProfile: { username: string; display_name: string | null } | null = null;
  if (user && preview.kind === 'admin') {
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('username,display_name')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    ownProfile = profile;
  }

  return (
    <>
      <Header />
      <main className="formWrap invitationLandingWrap">
        <section className="form invitationLanding">
          <div className="tag">// SECURE INVITATION</div>
          {preview.status === 'expired' || preview.status === 'revoked' ||
            preview.status === 'redeemed' || preview.status === 'rejected' ? (
            <>
              <h1>INVITATION {preview.status.toUpperCase()}.</h1>
              <p>This invitation is no longer available. Ask the inviter or an administrator about next steps.</p>
              {preview.status === 'redeemed' && <p>Your invitation has already been used.</p>}
            </>
          ) : preview.kind === 'player' ? (
            <>
              <h1>YOU HAVE BEEN IDENTIFIED.</h1>
              <p>An existing member of the Scamtastic network has requested your presence.</p>
              {preview.inviter && (
                <div className="inviterIdentity">
                  <ProceduralAvatar
                    className="neuralConnectionAvatar"
                    seed={preview.inviter.avatar_seed}
                    version={preview.inviter.avatar_version}
                    label={`${preview.inviter.username} avatar`}
                  />
                  <div><span>INVITED BY</span><strong>{preview.inviter.display_name || preview.inviter.username}</strong><code>@{preview.inviter.username}</code></div>
                </div>
              )}
              <p className="invitationAuthorization">AUTHORIZATION: PENDING ADMINISTRATOR REVIEW</p>
              {preview.status === 'pending' ? (
                <Link className="button primary wide" href={`/apply?invite=${encodeURIComponent(code)}`}>
                  Request access →
                </Link>
              ) : (
                <p className="invitationAuthorization">
                  {preview.status === 'submitted'
                    ? 'APPLICATION RECEIVED · ADMINISTRATOR REVIEW PENDING'
                    : 'APPLICATION APPROVED · CHECK YOUR EMAIL FOR THE SECURE ACTIVATION LINK'}
                </p>
              )}
              <p className="micro">Your application will be reviewed by individuals of questionable qualifications.</p>
            </>
          ) : (
            <>
              <h1>YOU HAVE BEEN SUMMONED.</h1>
              <p>Scamtastic Administration has personally authorized your entry into the network.</p>
              <p className="invitationAuthorization">AUTHORIZATION: GRANTED</p>
              {user && ownProfile ? (
                <AdminInvitationClaimForm
                  code={code}
                  username={ownProfile.username}
                  displayName={ownProfile.display_name ?? ''}
                  existingProfile
                />
              ) : user ? (
                <>
                  <p>Verified as <strong>{user.email}</strong>. Choose a public username to complete setup.</p>
                  <AdminInvitationClaimForm code={code} />
                </>
              ) : (
                <p>Use the secure activation link sent to the invited email address to continue.</p>
              )}
              <p className="micro">Congratulations. Your presence is now officially our problem.</p>
            </>
          )}
          <p className="invitationExpiry">Invitation expires {new Date(preview.expires_at).toLocaleDateString()}.</p>
        </section>
      </main>
    </>
  );
}
