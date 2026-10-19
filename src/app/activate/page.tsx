import { redirect } from 'next/navigation';
import ActivationForm from '@/components/ActivationForm';
import Header from '@/components/Header';
import { supabaseServer } from '@/lib/server';

export const dynamic = 'force-dynamic';

export default async function Activate() {
  const db = await supabaseServer();
  const { data, error } = await db.auth.getUser();
  if (error) throw error;
  if (!data.user) redirect('/login?error=callback');
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('id')
    .eq('id', data.user.id)
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
