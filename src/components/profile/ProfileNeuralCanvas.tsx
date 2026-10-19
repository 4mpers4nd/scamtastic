'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import NeuralCanvas from '@/components/neural/NeuralCanvas';
import SystemNodePanel from '@/components/neural/SystemNodePanel';
import { profileHref } from '@/lib/profile-route.mjs';
import type { NeuralConnection, NeuralSearchResult } from '@/lib/neural/types';

type Props = {
  nodes: NeuralSearchResult[];
  connections: NeuralConnection[];
  playerId: string;
  username: string;
  avatarSeed: string;
  avatarVersion: number;
  maxStrength: number;
};

export default function ProfileNeuralCanvas({
  nodes,
  connections,
  playerId,
  username,
  avatarSeed,
  avatarVersion,
  maxStrength,
}: Props) {
  const router = useRouter();
  const [systemSelected, setSystemSelected] = useState(false);

  return (
    <>
      <NeuralCanvas
        className="profileNeuralCanvas"
        nodes={nodes}
        connections={connections}
        selectedId={playerId}
        focusId={playerId}
        maxStrength={maxStrength}
        centralAvatar={{
          nodeId: playerId,
          seed: avatarSeed,
          version: avatarVersion,
        }}
        autoRotate
        onSystemSelect={() => setSystemSelected((selected) => !selected)}
        onSelect={(node) => {
          if (node.id !== playerId) router.push(profileHref(node.username));
        }}
        label={`${username}'s player connections`}
      />
      {systemSelected && <SystemNodePanel onClose={() => setSystemSelected(false)} />}
    </>
  );
}
