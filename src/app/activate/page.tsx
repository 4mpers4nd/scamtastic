import { redirect } from 'next/navigation';
import ActivationForm from '@/components/ActivationForm';
import Header from '@/components/Header';
import { getAccessDecision } from '@/lib/auth-state.mjs';
import { authenticatedUser } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Activate() {
  const { db, user } = await authenticatedUser();
  if (getAccessDecision(user) === 'login') redirect('/login?error=callback');
  const player = user ?? redirect('/login?error=callback');
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id')
    .eq('id', player.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    return (
      <>
        <Header />
        <main className="formWrap">
          <section className="form">
            <div className="tag">// ACTIVATION REQUIRED</div>
            <h1>Access is not approved.</h1>
            <p>This verified email does not have an approved application.</p>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="formWrap">
        <ActivationForm />
      </main>
    </>
  );
}
