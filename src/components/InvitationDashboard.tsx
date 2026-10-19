'use client';

import { useEffect, useState } from 'react';

type Invitation = {
  id: string;
  status: string;
  created_at: string;
  expires_at: string;
};

type CreditRequest = {
  id: string;
  requested: number;
  explanation: string | null;
  status: string;
  granted: number | null;
  created_at: string;
};

type Dashboard = {
  available: number;
  total: number;
  pending: number;
  successful: number;
  closed: number;
  invitations: Invitation[];
  requests: CreditRequest[];
};

async function parseResponse(response: Response) {
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof data === 'object' && data !== null && 'error' in data &&
      typeof data.error === 'string' ? data.error : 'Unable to update invitations.';
    throw new Error(message);
  }
  return data;
}

export default function InvitationDashboard() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [latestLink, setLatestLink] = useState('');

  async function refresh() {
    const data = await parseResponse(await fetch('/api/invitations', { cache: 'no-store' }));
    setDashboard(data as Dashboard);
  }

  useEffect(() => {
    void refresh().catch((loadError: unknown) => {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load invitations.');
    });
  }, []);

  async function createInvitation() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const data = await parseResponse(await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      })) as { code: string };
      const link = `${window.location.origin}/invite/${data.code}`;
      setLatestLink(link);
      setMessage('Invitation created. It requires administrator approval after the recipient applies.');
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to create invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function requestCredits(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setBusy(true);
    setError('');
    setMessage('');
    const form = new FormData(event.currentTarget);
    try {
      await parseResponse(await fetch('/api/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          requested: Number(form.get('requested')),
          explanation: form.get('explanation'),
        }),
      }));
      formElement.reset();
      setMessage('Credit request submitted for administrator review.');
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to submit request.');
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await parseResponse(await fetch('/api/invitations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      }));
      setMessage('Invitation revoked; its credit has been returned.');
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'Unable to revoke invitation.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(latestLink);
      setMessage('Invitation link copied.');
    } catch {
      setError('Clipboard access is unavailable. Select and copy the link below.');
    }
  }

  if (!dashboard && !error) return <p className="muted" role="status">Loading invitation dashboard…</p>;
  return (
    <div className="invitationDashboard">
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="successMessage" role="status">{message}</p>}
      {dashboard && (
        <>
          <dl className="invitationStats">
            <div><dt>Available credits</dt><dd>{dashboard.available}</dd></div>
            <div><dt>Total invitations</dt><dd>{dashboard.total}</dd></div>
            <div><dt>Pending</dt><dd>{dashboard.pending}</dd></div>
            <div><dt>Successful referrals</dt><dd>{dashboard.successful}</dd></div>
            <div><dt>Expired / closed</dt><dd>{dashboard.closed}</dd></div>
          </dl>
          <button className="button primary" type="button" disabled={busy || dashboard.available < 1} onClick={createInvitation}>
            Generate invitation
          </button>
          {latestLink && (
            <div className="invitationLink">
              <label htmlFor="new-invitation-link">New invitation link</label>
              <div><input id="new-invitation-link" readOnly value={latestLink} /><button className="button secondary" type="button" onClick={copyLink}>Copy</button></div>
            </div>
          )}
          <h2>Your invitations</h2>
          {dashboard.invitations.length === 0 ? <p className="muted">No invitations created yet.</p> : (
            <div className="referralList">
              {dashboard.invitations.map((invitation) => (
                <article className="referralItem" key={invitation.id}>
                  <div><strong>{invitation.status}</strong><span>Expires {new Date(invitation.expires_at).toLocaleDateString()}</span></div>
                  {invitation.status === 'pending' && <button className="button secondary" type="button" disabled={busy} onClick={() => void revoke(invitation.id)}>Revoke</button>}
                </article>
              ))}
            </div>
          )}
          <h2>Request additional credits</h2>
          <form className="form invitationRequestForm" onSubmit={requestCredits}>
            <label>Requested quantity<input name="requested" type="number" min={1} max={20} defaultValue={5} required /></label>
            <label>Explanation <span className="muted">(optional)</span><textarea name="explanation" maxLength={1000} rows={3} /></label>
            <button className="button secondary" disabled={busy}>Submit request</button>
          </form>
          {dashboard.requests.length > 0 && (
            <>
              <h2>Credit requests</h2>
              <div className="referralList">
                {dashboard.requests.map((request) => (
                  <article className="referralItem" key={request.id}>
                    <div><strong>{request.status}</strong><span>{request.requested} requested{request.granted ? ` · ${request.granted} granted` : ''}</span></div>
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
