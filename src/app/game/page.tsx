import Link from 'next/link';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';
import { supabaseServer } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Game() {
  const db = await supabaseServer();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();

  if (authError) throw authError;
  if (!user) redirect('/login');

  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('username,is_banned')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) throw profileError;

  if (!profile || profile.is_banned) {
    return (
      <>
        <Header />
        <main className="formWrap">
          <div className="form">
            <div className="tag">// ACCESS PENDING</div>
            <h1>Not authorized.</h1>
            <p>
              Your account is authenticated, but it does not have an active,
              approved player profile.
            </p>
            <Link className="button secondary" href="/">
              Home
            </Link>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="section">
        <div className="tag">// SCAMTASTIC PRIVATE ALPHA</div>
        <h1>Welcome, {profile.username}.</h1>
        <p>The game systems are under construction. Your account has been verified.</p>
        <div className="grid">
          <div className="card">
            <h3>Network</h3>
            <p>Coming soon.</p>
          </div>
          <div className="card">
            <h3>Opportunities</h3>
            <p>Coming soon.</p>
          </div>
          <div className="card">
            <h3>SCAMCOINS</h3>
            <p>Fixed supply economy in development.</p>
          </div>
        </div>
      </main>
    </>
  );
}
