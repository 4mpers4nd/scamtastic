'use client';

import { useActionState } from 'react';
import {
  createOwnReferral,
  reviewApplication,
  revokeOwnReferral,
  retryActivation,
  revokeReferral,
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

export function ReferralRevokeForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeReferral, null);
  return (
    <form action={action}>
      <input type="hidden" name="codeId" value={id} />
      <button
        className="button danger"
        disabled={pending}
        onClick={(event) => {
          if (!window.confirm('Revoke this referral code? Existing links will stop working.')) {
            event.preventDefault();
          }
        }}
      >
        {pending ? 'Revoking…' : 'Revoke'}
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

export function OwnReferralForm() {
  const [state, action, pending] = useActionState(createOwnReferral, null);
  return (
    <form action={action} className="inlineForm">
      <label>
        Usage limit
        <input type="number" name="usageLimit" min={1} max={100} defaultValue={5} required />
      </label>
      <button className="button secondary" disabled={pending}>
        {pending ? 'Creating…' : 'Create referral code'}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function OwnReferralRevokeForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(revokeOwnReferral, null);
  return (
    <form action={action}>
      <input type="hidden" name="codeId" value={id} />
      <button
        className="button danger"
        disabled={pending}
        onClick={(event) => {
          if (!window.confirm('Revoke this referral code? Existing links will stop working.')) {
            event.preventDefault();
          }
        }}
      >
        {pending ? 'Revoking…' : 'Revoke'}
      </button>
      <Feedback state={state} />
    </form>
  );
}
