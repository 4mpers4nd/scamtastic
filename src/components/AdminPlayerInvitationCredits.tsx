'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPlayerInvitationCredits({
  playerId,
  username,
}: {
  playerId: string;
  username: string;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [operationKey, setOperationKey] = useState('');
  const router = useRouter();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError('');
    setMessage('');
    const key = operationKey || crypto.randomUUID();
    setOperationKey(key);
    try {
      const response = await fetch('/api/admin/invitations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust-credits',
          playerId,
          operation: values.get('operation'),
          amount: Number(values.get('amount')),
          operationKey: key,
        }),
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === 'object' && data !== null && 'error' in data &&
          typeof data.error === 'string' ? data.error : 'Unable to update credits.',
        );
      }
      setMessage('Credits updated.');
      setOperationKey('');
      router.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Unable to update credits.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <form className="creditAdjustmentForm" onSubmit={submit}>
        <label>Manage @{username} credits
          <select name="operation">
            <option value="grant">Grant</option>
            <option value="set">Set balance</option>
          </select>
        </label>
        <label>Amount<input name="amount" type="number" min={0} max={10000} defaultValue={5} required /></label>
        <button className="button secondary" disabled={busy}>{busy ? 'Saving…' : 'Update credits'}</button>
      </form>
      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="successMessage" role="status">{message}</p>}
    </div>
  );
}
