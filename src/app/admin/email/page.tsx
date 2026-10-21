import AdminEmailComposer from '@/components/AdminEmailComposer';

export default function AdminEmailPage() {
  return (
    <>
      <div className="adminPageHeading">
        <div className="tag">// CONTROLLED MAIL DELIVERY</div>
        <h1>Email composer</h1>
        <p>Compose branded messages, preview sanitized output, and deliver to a bounded recipient list.</p>
      </div>
      <AdminEmailComposer />
    </>
  );
}
