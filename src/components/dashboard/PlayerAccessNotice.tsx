import Link from 'next/link';
import Header from '@/components/Header';

export default function PlayerAccessNotice({ suspended }: { suspended: boolean }) {
  return (
    <>
      <Header />
      <main className="formWrap">
        <section className="form">
          <div className="tag">// ACCESS {suspended ? 'SUSPENDED' : 'PENDING'}</div>
          <h1>{suspended ? 'Player access is paused.' : 'Your player profile is not ready yet.'}</h1>
          <p>
            {suspended
              ? 'Your account is authenticated, but its active player features are unavailable.'
              : 'The Network Command Center is available after your player profile is approved.'}
          </p>
          <Link className="button secondary" href="/network">
            Explore the public network
          </Link>
        </section>
      </main>
    </>
  );
}
