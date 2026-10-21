'use client';

import { useEffect, useState } from 'react';
import NeuralCanvas from '@/components/neural/NeuralCanvas';
import SystemNodePanel from '@/components/neural/SystemNodePanel';
import { parseNeuralSnapshot, type NeuralSnapshot } from '@/lib/neural/types';

export default function Network() {
  const [snapshot, setSnapshot] = useState<NeuralSnapshot | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [systemSelected, setSystemSelected] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadNetwork() {
      try {
        const response = await fetch('/api/network?limit=150', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Network request failed');
        const data = parseNeuralSnapshot(await response.json());
        if (!data) throw new Error('Network data was invalid');
        setSnapshot(data);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        console.error('Homepage neural network unavailable:', error);
        setUnavailable(true);
      }
    }

    void loadNetwork();
    return () => controller.abort();
  }, []);

  if (unavailable) {
    return (
      <div className="networkUnavailable" role="status">
        The player network is temporarily unavailable.
      </div>
    );
  }
  if (!snapshot) {
    return <div className="networkLoading" aria-hidden="true" />;
  }

  return (
    <>
      <NeuralCanvas
        className="networkHeroCanvas"
        nodes={snapshot.nodes}
        connections={snapshot.connections}
        autoRotate
        onSystemSelect={() => setSystemSelected((selected) => !selected)}
      />
      {systemSelected && <SystemNodePanel onClose={() => setSystemSelected(false)} />}
    </>
  );
}
