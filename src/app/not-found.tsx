import Link from 'next/link';
import Header from '@/components/Header';

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="formWrap">
        <section className="form publicNotFound">
          <div className="tag">// NETWORK RESPONSE 404</div>
          <h1>This signal is off the network.</h1>
          <p>The requested page or invitation could not be found or is no longer available.</p>
          <Link className="button secondary" href="/">Return to the network</Link>
        </section>
      </main>
    </>
  );
}
