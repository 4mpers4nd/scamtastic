'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProceduralAvatar from '@/components/ProceduralAvatar';

export default function AvatarReroll({
  initialSeed,
  initialVersion,
  username,
}: {
  initialSeed: string;
  initialVersion: number;
  username: string;
}) {
  const [seed, setSeed] = useState(initialSeed);
  const [version, setVersion] = useState(initialVersion);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function reroll() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/avatar/reroll', { method: 'POST' });
      const result = (await response.json()) as {
        avatarSeed?: unknown;
        avatarVersion?: unknown;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || 'Unable to reroll your avatar.');
      if (typeof result.avatarSeed !== 'string' || typeof result.avatarVersion !== 'number') {
        throw new Error('The server returned an invalid avatar.');
      }
      setSeed(result.avatarSeed);
      setVersion(result.avatarVersion);
      setMessage('A new avatar has been generated and saved to your profile.');
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reroll your avatar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="avatarReroll">
      <ProceduralAvatar
        className="largeAvatar"
        seed={seed}
        version={version}
        label={`${username} avatar preview`}
      />
      <div>
        <p>Procedural avatar · generator v{version}</p>
        <button className="button secondary" type="button" onClick={reroll} disabled={busy}>
          {busy ? 'Generating…' : 'Reroll avatar'}
        </button>
      </div>
      {message && <p className="avatarMessage" role="status">{message}</p>}
    </div>
  );
}
