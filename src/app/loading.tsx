export default function Loading() {
  return (
    <main className="formWrap" aria-busy="true" aria-live="polite">
      <p className="status">LOADING NETWORK…</p>
    </main>
  );
}
