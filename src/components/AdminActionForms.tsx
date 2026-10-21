'use client';

import { useActionState, useState } from 'react';
import {
  reviewApplication,
  retryActivation,
  setPlayerSuspended,
  updatePlayer,
  updateOwnProfile,
  type ActionResult,
} from '@/lib/actions';

function Feedback({ state }: { state: ActionResult }) {
  if (!state) return null;
  return (
    <p className={state.error ? 'error' : 'success'} role={state.error ? 'alert' : 'status'}>
      {state.message}
    </p>
  );
}

export function ApplicationReviewForm({
  id,
  status,
  notes,
}: {
  id: string;
  status: string;
  notes: string | null;
}) {
  const [state, action, pending] = useActionState(reviewApplication, null);
  return (
    <form action={action} className="adminActionForm">
      <input type="hidden" name="applicationId" value={id} />
      <label>
        Administrative notes
        <textarea name="adminNotes" maxLength={4000} rows={3} defaultValue={notes ?? ''} />
      </label>
      {status === 'pending' && (
        <div className="actionButtons">
          <button
            className="button primary"
            name="status"
            value="approved"
            disabled={pending}
            onClick={(event) => {
              if (!window.confirm('Approve this application and send an email activation link?')) {
                event.preventDefault();
              }
            }}
          >
            {pending ? 'Processing…' : 'Approve'}
          </button>
          <button
            className="button danger"
            name="status"
            value="rejected"
            disabled={pending}
            onClick={(event) => {
              if (!window.confirm('Reject this application?')) event.preventDefault();
            }}
          >
            Reject
          </button>
        </div>
      )}
      <Feedback state={state} />
    </form>
  );
}

export function ActivationRetryForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(retryActivation, null);
  return (
    <form action={action}>
      <input type="hidden" name="applicationId" value={id} />
      <button className="button secondary" disabled={pending}>
        {pending ? 'Sending…' : 'Resend activation email'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function TestEmailForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<ActionResult>(null);

  async function sendTestEmail() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const error =
          typeof result === 'object' &&
          result !== null &&
          'error' in result &&
          typeof result.error === 'string'
            ? result.error
            : 'The test email could not be sent.';
        throw new Error(error);
      }
      setMessage({ message: 'Test email sent to your verified administrator address.', error: false });
    } catch (error) {
      setMessage({
        message: error instanceof Error ? error.message : 'The test email could not be sent.',
        error: true,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <div>
      <button type="button" className="button secondary" onClick={sendTestEmail} disabled={pending}>
        {pending ? 'Sending test email…' : 'Send test email to me'}
      </button>
      <Feedback state={message} />
    </div>
  );
}

export function PlayerAccessForm({
  id,
  suspended,
}: {
  id: string;
  suspended: boolean;
}) {
  const [state, action, pending] = useActionState(setPlayerSuspended, null);
  return (
    <form action={action}>
      <input type="hidden" name="playerId" value={id} />
      <input type="hidden" name="suspended" value={String(!suspended)} />
      <button
        className={suspended ? 'button primary' : 'button danger'}
        disabled={pending}
        onClick={(event) => {
          if (!window.confirm(suspended ? 'Restore this player’s access?' : 'Suspend this player?')) {
            event.preventDefault();
          }
        }}
      >
        {pending ? 'Saving…' : suspended ? 'Restore access' : 'Suspend player'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function PlayerEditForm({
  id,
  displayName,
  bio,
}: {
  id: string;
  displayName: string | null;
  bio: string | null;
}) {
  const [state, action, pending] = useActionState(updatePlayer, null);
  return (
    <form action={action} className="adminActionForm">
      <input type="hidden" name="playerId" value={id} />
      <label>
        Display name
        <input name="displayName" maxLength={80} defaultValue={displayName ?? ''} />
      </label>
      <label>
        Bio
        <textarea name="bio" maxLength={500} rows={3} defaultValue={bio ?? ''} />
      </label>
      <button className="button secondary" disabled={pending}>
        {pending ? 'Saving…' : 'Save profile'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function OwnProfileForm({
  displayName,
  bio,
}: {
  displayName: string | null;
  bio: string | null;
}) {
  const [state, action, pending] = useActionState(updateOwnProfile, null);
  return (
    <form action={action} className="form">
      <div className="tag">// PROFILE PREFERENCES</div>
      <label>
        Display name
        <input name="displayName" maxLength={80} defaultValue={displayName ?? ''} />
      </label>
      <label>
        Bio
        <textarea name="bio" maxLength={500} rows={5} defaultValue={bio ?? ''} />
      </label>
      <p className="muted">Your avatar is generated from a saved profile seed. Account credentials and username are not editable here.</p>
      <button className="button primary wide" disabled={pending}>
        {pending ? 'Saving…' : 'Save settings'}
      </button>
      <Feedback state={state} />
    </form>
  );
}
