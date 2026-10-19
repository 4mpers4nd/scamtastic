'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="formWrap">
      <section className="form" role="alert">
        <div className="tag">// CONNECTION INTERRUPTED</div>
        <h1>That request failed.</h1>
        <p>We could not complete the request. No account details or credentials are shown here.</p>
        <button className="button primary wide" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
