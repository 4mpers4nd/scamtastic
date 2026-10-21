'use client';

import { useEffect, useState } from 'react';

type InvitationRow = {
  id: string;
  kind: 'player' | 'admin';
  status: string;
  username: string | null;
  invitee_username: string | null;
  email: string | null;
  created_at: string;
  expires_at: string;
  redeemed_at: string | null;
  credit_balance: number | null;
};
type RequestRow = {
  id: string;
  username: string;
  requested: number;
  granted: number | null;
  status: string;
  explanation: string | null;
  created_at: string;
  credits: number;
};
type PlayerRow = { id: string; username: string; credits: number; invitations: number; recruited: number };
type Overview = {
  invitations: InvitationRow[];
  requests: RequestRow[];
  players: PlayerRow[];
  total: number;
  pending: number;
  successful: number;
};

async function api(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const data: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof data === 'object' && data !== null && 'error' in data &&
      typeof data.error === 'string' ? data.error : 'Administrator request failed.',
    );
  }
  return data;
}

export default function AdminInvitationManager() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [creditOperationKeys, setCreditOperationKeys] = useState<Record<string, string>>({});

  async function refresh(query = search, status = statusFilter) {
    const queryString = new URLSearchParams({ q: query });
    if (status) queryString.set('status', status);
    const data = await api(`/api/admin/invitations?${queryString.toString()}`);
    setOverview(data as Overview);
  }

  useEffect(() => {
    void refresh('').catch((loadError: unknown) =>
      setError(loadError instanceof Error ? loadError.message : 'Unable to load invitations.'),
    );
  }, []);

  async function mutate(payload: Record<string, unknown>, success: string): Promise<boolean> {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await api('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setMessage(success);
      await refresh();
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to complete request.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function submitInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    await mutate({
      action: 'issue',
      email: values.get('email'),
      expiresDays: Number(values.get('expiresDays')),
    }, 'Administrator invitation sent.');
    form.reset();
  }

  async function searchPlayers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await refresh(search.trim(), statusFilter);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="adminInvitationManager">
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="successMessage" role="status">{message}</p>}
      {overview && (
        <>
          <dl className="invitationStats">
            <div><dt>All invitations</dt><dd>{overview.total}</dd></div>
            <div><dt>Pending</dt><dd>{overview.pending}</dd></div>
            <div><dt>Successful</dt><dd>{overview.successful}</dd></div>
          </dl>
          <section className="adminPanel">
            <div className="tag">// DIRECT AUTHORIZATION</div>
            <h2>Invite a new administrator-approved player</h2>
            <form className="adminInlineForm" onSubmit={submitInvite}>
              <label>Verified recipient email<input required type="email" name="email" maxLength={254} autoComplete="email" /></label>
              <label>Expires after (days)<input required type="number" name="expiresDays" min={1} max={90} defaultValue={14} /></label>
              <button className="button primary" disabled={busy}>Send secure invitation</button>
            </form>
          </section>

          <section className="adminPanel">
            <div className="tag">// PLAYER CREDIT REQUESTS</div>
            <h2>Additional-credit requests</h2>
            {overview.requests.length === 0 ? <p className="muted">No pending requests.</p> : (
              <div className="referralList">
                {overview.requests.map((request) => (
                  <article className="referralItem adminCreditRequest" key={request.id}>
                    <div><strong>@{request.username}</strong><span>{request.requested} requested · balance {request.credits}</span>{request.explanation && <p>{request.explanation}</p>}</div>
                    <label>Grant<input type="number" min={1} max={20} defaultValue={request.requested} id={`grant-${request.id}`} /></label>
                    <button className="button primary" disabled={busy} onClick={() => {
                      const field = document.getElementById(`grant-${request.id}`) as HTMLInputElement | null;
                      void mutate({ action: 'review-request', id: request.id, status: 'approved', granted: Number(field?.value) }, 'Credit request approved.');
                    }}>Approve</button>
                    <button className="button secondary" disabled={busy} onClick={() => void mutate({ action: 'review-request', id: request.id, status: 'denied' }, 'Credit request denied.')}>Deny</button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="adminPanel">
            <div className="tag">// INVITATION REGISTER</div>
            <h2>Issued invitations</h2>
            <form className="searchForm" onSubmit={searchPlayers}>
              <label className="visuallyHidden" htmlFor="invitation-search">Search invitations and players</label>
              <input id="invitation-search" value={search} onChange={(event) => setSearch(event.target.value)} maxLength={80} placeholder="Search username or invited email" />
              <select value={statusFilter} aria-label="Filter invitation status" onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="submitted">Application submitted</option>
                <option value="approved">Approved</option>
                <option value="redeemed">Redeemed</option>
                <option value="rejected">Rejected</option>
                <option value="expired">Expired</option>
                <option value="revoked">Revoked</option>
              </select>
              <button className="button secondary" disabled={busy}>Search</button>
            </form>
            <div className="referralList">
              {overview.invitations.map((invitation) => (
                <article className="referralItem adminInvitationRow" key={invitation.id}>
                  <div>
                    <strong>{invitation.kind === 'admin' ? 'Administrator authorization' : `Player invite · @${invitation.username ?? 'unknown'}`}</strong>
                    {invitation.invitee_username && <span>Applicant / recruited player: @{invitation.invitee_username}</span>}
                    {invitation.email && <span>{invitation.email}</span>}
                    <span>{invitation.status} · expires {new Date(invitation.expires_at).toLocaleDateString()}</span>
                  </div>
                  {invitation.status === 'pending' && (
                    <button className="button secondary" disabled={busy} onClick={() => void mutate({ action: 'revoke', id: invitation.id }, 'Invitation revoked.')}>Revoke</button>
                  )}
                </article>
              ))}
            </div>
          </section>

          <section className="adminPanel">
            <div className="tag">// PLAYER CREDIT MANAGEMENT</div>
            <h2>Credits and recruitment history</h2>
            <div className="referralList">
              {overview.players.map((player) => (
                <article className="referralItem adminPlayerCredits" key={player.id}>
                  <div><strong>@{player.username}</strong><span>{player.credits} credits · {player.invitations} invitations · {player.recruited} joined</span></div>
                  <form className="creditAdjustmentForm" onSubmit={(event) => {
                    event.preventDefault();
                    const form = event.currentTarget;
                    const data = new FormData(form);
                    const operationKey = creditOperationKeys[player.id] ?? crypto.randomUUID();
                    setCreditOperationKeys((current) => ({
                      ...current,
                      [player.id]: operationKey,
                    }));
                    void mutate({
                      action: 'adjust-credits',
                      playerId: player.id,
                      operation: data.get('operation'),
                      amount: Number(data.get('amount')),
                      operationKey,
                    }, 'Player credits updated.').then((updated) => {
                      if (updated) {
                        setCreditOperationKeys((current) => {
                          const next = { ...current };
                          delete next[player.id];
                          return next;
                        });
                      }
                    });
                  }}>
                    <select name="operation" aria-label={`Credit action for ${player.username}`}><option value="grant">Grant</option><option value="set">Set balance</option></select>
                    <input name="amount" type="number" min={0} max={10000} defaultValue={5} aria-label={`Credit amount for ${player.username}`} />
                    <button className="button secondary" disabled={busy}>Update</button>
                  </form>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
