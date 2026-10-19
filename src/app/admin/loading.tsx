export default function AdminLoading() {
  return (
    <section className="adminPanel" aria-busy="true" aria-live="polite">
      <p className="status">LOADING ADMIN DATA…</p>
    </section>
  );
}
