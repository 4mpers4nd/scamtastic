'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ProceduralAvatar from '@/components/ProceduralAvatar';
import { supabaseBrowser } from '@/lib/supabase';

type Props = {
  displayName: string | null;
  username: string | null;
  avatarSeed: string | null;
  avatarVersion: number | null;
  isAdmin: boolean;
};

export default function HeaderAccount({
  displayName,
  username,
  avatarSeed,
  avatarVersion,
  isAdmin,
}: Props) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const label = displayName || username || 'Account';
  const profileHref = username ? `/profile/${encodeURIComponent(username)}` : '/settings';

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await supabaseBrowser().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace('/');
      router.refresh();
    } catch {
      setError('Unable to sign out. Please try again.');
      setBusy(false);
    }
  }

  return (
    <details className="accountMenu">
      <summary aria-label={`Account menu for ${label}`}>
        {avatarSeed && avatarVersion ? (
          <ProceduralAvatar
            className="avatar"
            seed={avatarSeed}
            version={avatarVersion}
            label={`${label} avatar`}
          />
        ) : (
          <span className="avatar avatarFallback" aria-hidden="true">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="accountName">{label}</span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className="accountDropdown">
        {username && <Link href={profileHref}>My Profile</Link>}
        <Link href="/game">Game Dashboard</Link>
        <Link href="/settings">Account Settings</Link>
        {isAdmin && <Link href="/admin">Administration</Link>}
        <button type="button" onClick={signOut} disabled={busy}>
          {busy ? 'Signing out…' : 'Sign Out'}
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
    </details>
  );
}
