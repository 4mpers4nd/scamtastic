'use client';

import { useActionState } from 'react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { claimAdministratorInvitation } from '@/lib/actions';

export default function AdminInvitationClaimForm({
  code,
  username = '',
  displayName = '',
  existingProfile = false,
}: {
  code: string;
  username?: string;
  displayName?: string;
  existingProfile?: boolean;
}) {
  const [result, action, pending] = useActionState(claimAdministratorInvitation, null);
  const router = useRouter();

  useEffect(() => {
    if (result && !result.error) {
      router.replace('/activate');
      router.refresh();
    }
  }, [result, router]);

  return (
    <form className="form adminInviteClaimForm" action={action}>
      <input type="hidden" name="invitationCode" value={code} />
      {existingProfile ? (
        <>
          <input type="hidden" name="username" value={username} />
          <input type="hidden" name="displayName" value={displayName} />
          <p>Your existing player profile is already active.</p>
        </>
      ) : (
        <>
          <label>
            Choose your username
            <input required name="username" minLength={3} maxLength={24} pattern="[A-Za-z0-9_&-]{3,24}" autoComplete="username" />
          </label>
          <label>
            Display name <span className="muted">(optional)</span>
            <input name="displayName" maxLength={80} autoComplete="nickname" />
          </label>
        </>
      )}
      {result?.error && <p className="error" role="alert">{result.message}</p>}
      <button className="button primary wide" disabled={pending}>
        {pending ? 'Activating…' : 'Activate account →'}
      </button>
    </form>
  );
}
