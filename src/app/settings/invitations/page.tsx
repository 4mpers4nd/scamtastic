import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import InvitationDashboard from '@/components/InvitationDashboard';
import { authenticatedUser } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function InvitationsSettings() {
  const { db, user } = await authenticatedUser();
  if (!user) redirect('/login');
  const { data: profile, error } = await db
    .from('profiles')
    .select('is_banned')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;

  return (
    <>
      <Header />
      <main className="formWrap settingsWrap">
        <section className="adminPanel invitationPage">
          <div className="tag">// INVITATION CREDITS</div>
          <h1>Grow the network carefully.</h1>
          <p className="muted">
            Player invitations request access; administrators still review every application.
            Expired and revoked unused invitations return their credit.
          </p>
          {profile && !profile.is_banned
            ? <InvitationDashboard />
            : <p className="error">Invitation management is unavailable for this account.</p>}
        </section>
      </main>
    </>
  );
}
