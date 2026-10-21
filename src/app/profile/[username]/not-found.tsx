import Link from 'next/link';
import Header from '@/components/Header';

export default function ProfileNotFound() {
  return (
    <>
      <Header />
      <main className="formWrap">
        <section className="publicProfile profileNotFound">
          <div className="tag">// PROFILE NOT FOUND</div>
          <h1>This player is off the network.</h1>
          <p className="profileBio">
            The profile may not exist or may no longer be publicly available.
          </p>
          <Link className="button secondary" href="/">
            Return to the network
          </Link>
        </section>
      </main>
    </>
  );
}
