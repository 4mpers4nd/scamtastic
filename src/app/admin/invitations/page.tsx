import AdminInvitationManager from '@/components/AdminInvitationManager';

export default function AdminInvitationsPage() {
  return (
    <>
      <div className="adminPageHeading">
        <div className="tag">// INVITATION CONTROL</div>
        <h1>Invitations</h1>
        <p>Review authorizations, player credits, and recruitment activity.</p>
      </div>
      <AdminInvitationManager />
    </>
  );
}
