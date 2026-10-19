'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import ProceduralAvatar from '@/components/ProceduralAvatar';
import NeuralCanvas from '@/components/neural/NeuralCanvas';
import SystemNodePanel from '@/components/neural/SystemNodePanel';
import { profileHref } from '@/lib/profile-route.mjs';
import {
  parseNeuralSearchResults,
  parseNeuralSnapshot,
  parsePublicNeuralProfile,
  type NeuralConnection,
  type NeuralNode,
  type NeuralSearchResult,
  type NeuralSnapshot,
  type PublicNeuralProfile,
} from '@/lib/neural/types';

type CameraMode = 'orbit' | 'flight';

export default function NeuralExplorer() {
  const [snapshot, setSnapshot] = useState<NeuralSnapshot | null>(null);
  const [baseNodes, setBaseNodes] = useState<NeuralNode[]>([]);
  const [baseConnections, setBaseConnections] = useState<NeuralConnection[]>([]);
  const [nodes, setNodes] = useState<NeuralSearchResult[]>([]);
  const [connections, setConnections] = useState<NeuralConnection[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<PublicNeuralProfile | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [systemSelected, setSystemSelected] = useState(false);
  const [cameraMode, setCameraMode] = useState<CameraMode>('orbit');
  const [cameraEpoch, setCameraEpoch] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageOffset, setPageOffset] = useState(300);
  const [refreshCount, setRefreshCount] = useState(0);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<NeuralSearchResult[]>([]);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadNetwork() {
      try {
        const response = await fetch('/api/network?limit=300', {
          signal: controller.signal,
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('The neural network is temporarily unavailable.');
        const data = parseNeuralSnapshot(await response.json());
        if (!data) throw new Error('The neural network returned invalid data.');
        setSnapshot(data);
        setBaseNodes(data.nodes);
        setBaseConnections(data.connections);
        setNodes(data.nodes);
        setConnections(data.connections);
        setError('');
      } catch (loadError) {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'The neural network is temporarily unavailable.',
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadNetwork();
    return () => controller.abort();
  }, [refreshCount]);

  const loadPlayer = useCallback(async (username: string) => {
    setSystemSelected(false);
    const requestId = ++requestRef.current;
    setSearchError('');
    try {
      const response = await fetch(
        `/api/network/profile/${encodeURIComponent(username)}`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error('Player details are temporarily unavailable.');
      const profile = parsePublicNeuralProfile(await response.json());
      if (!profile) throw new Error('Player details returned invalid data.');
      if (requestId !== requestRef.current) return;

      setSelectedProfile(profile);
      const selectedNode: NeuralSearchResult = {
        id: profile.playerId,
        username: profile.profile.username,
        displayName: profile.profile.display_name,
        avatarSeed: profile.profile.avatar_seed,
        avatarVersion: profile.profile.avatar_generator_version,
        x: profile.node?.x ?? 0,
        y: profile.node?.y ?? 0,
        z: profile.node?.z ?? 0,
      };
      const centralId = profile.playerId;
      const allNodes = new Map(nodes.map((node) => [node.id, node]));
      allNodes.set(centralId, { ...selectedNode, id: centralId });
      for (const connection of profile.connections) {
        allNodes.set(connection.player.id, connection.player);
      }
      setNodes([...allNodes.values()]);
      setConnections((previous) => {
        const merged = new Map(
          previous.map((connection) => [
            `${connection.playerA}:${connection.playerB}`,
            connection,
          ]),
        );
        for (const connection of profile.connections) {
          merged.set(`${connection.playerA}:${connection.playerB}`, connection);
        }
        return [...merged.values()];
      });
      setSelectedId(centralId);
    } catch (loadError) {
      if (requestId !== requestRef.current) return;
      setSearchError(
        loadError instanceof Error
          ? loadError.message
          : 'Player details are temporarily unavailable.',
      );
    }
  }, [nodes]);

  async function searchPlayers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    setSearchResults([]);
    setSearchError('');
    if (value.length < 2) {
      setSearchError('Enter at least two username characters.');
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/network/search?q=${encodeURIComponent(value)}`, {
        cache: 'no-store',
      });
      const data: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          typeof data === 'object' && data !== null && 'error' in data &&
            typeof data.error === 'string'
            ? data.error
            : 'Player search is temporarily unavailable.',
        );
      }
      const results = parseNeuralSearchResults(data);
      if (!results) throw new Error('Player search returned invalid data.');
      setSearchResults(results);
      if (results.length === 0) setSearchError('No active player matched that username.');
    } catch (searchFailure) {
      setSearchError(
        searchFailure instanceof Error
          ? searchFailure.message
          : 'Player search is temporarily unavailable.',
      );
    } finally {
      setSearching(false);
    }
  }

  async function loadMore() {
    if (!snapshot?.hasMore || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const response = await fetch(
        `/api/network?limit=300&offset=${pageOffset}`,
        { cache: 'no-store' },
      );
      if (!response.ok) throw new Error('The next network page is unavailable.');
      const page = parseNeuralSnapshot(await response.json());
      if (!page) throw new Error('The next network page returned invalid data.');
      const nextNodes = new Map(baseNodes.map((node) => [node.id, node]));
      for (const node of page.nodes) nextNodes.set(node.id, node);
      const nextConnections = new Map(
        baseConnections.map((connection) => [
          `${connection.playerA}:${connection.playerB}`,
          connection,
        ]),
      );
      for (const connection of page.connections) {
        nextConnections.set(`${connection.playerA}:${connection.playerB}`, connection);
      }
      const mergedBaseNodes = [...nextNodes.values()];
      const mergedBaseConnections = [...nextConnections.values()];
      const graphNodes = new Map(nodes.map((node) => [node.id, node]));
      for (const node of mergedBaseNodes) graphNodes.set(node.id, node);
      const graphConnections = new Map(
        connections.map((connection) => [
          `${connection.playerA}:${connection.playerB}`,
          connection,
        ]),
      );
      for (const connection of mergedBaseConnections) {
        graphConnections.set(`${connection.playerA}:${connection.playerB}`, connection);
      }
      setBaseNodes(mergedBaseNodes);
      setBaseConnections(mergedBaseConnections);
      setNodes([...graphNodes.values()]);
      setConnections([...graphConnections.values()]);
      setSnapshot({
        ...page,
        nodes: mergedBaseNodes,
        connections: mergedBaseConnections,
      });
      setPageOffset((offset) => offset + 300);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'The next network page is unavailable.',
      );
    } finally {
      setLoadingMore(false);
    }
  }

  function resetView() {
    requestRef.current += 1;
    setSelectedProfile(null);
    setSelectedId(null);
    setSystemSelected(false);
    setSearchResults([]);
    setSearchError('');
    setNodes(baseNodes);
    setConnections(baseConnections);
    setCameraEpoch((value) => value + 1);
  }

  function refreshNetwork() {
    requestRef.current += 1;
    setSnapshot(null);
    setBaseNodes([]);
    setBaseConnections([]);
    setNodes([]);
    setConnections([]);
    setSelectedProfile(null);
    setSelectedId(null);
    setSystemSelected(false);
    setSearchResults([]);
    setSearchError('');
    setPageOffset(300);
    setCameraEpoch((value) => value + 1);
    setRefreshCount((value) => value + 1);
  }

  function selectNode(node: NeuralSearchResult) {
    setSystemSelected(false);
    void loadPlayer(node.username);
  }

  const selected = selectedProfile;
  const detailConnections = selected?.connections ?? [];

  return (
    <main className="networkExplorer">
      <NeuralCanvas
        key={cameraEpoch}
        className="networkExplorerCanvas"
        nodes={nodes}
        connections={connections}
        selectedId={selectedId}
        focusId={selectedId}
        maxStrength={snapshot?.maxStrength ?? 20}
        cameraMode={cameraMode}
        onSelect={selectNode}
        onSystemSelect={() => {
          setSelectedProfile(null);
          setSelectedId(null);
          setSystemSelected((selected) => !selected);
        }}
      />
      <div className="networkExplorerShade" aria-hidden="true" />
      <section className="networkControls" aria-label="Network controls">
        <div className="tag">// PLAYER NEURAL NETWORK</div>
        <h1>Every connection is earned.</h1>
        <p>
          {loading
            ? 'Connecting to the player network…'
            : error
              ? error
              : `${snapshot?.totalNodes ?? 0} active player ${
                  snapshot?.totalNodes === 1 ? 'neuron' : 'neurons'
                }`}
        </p>
        {snapshot?.hasMore && (
          <p className="neuralLoadNote">
            Showing a paginated network view. Search to focus on a specific player.
          </p>
        )}
        {snapshot?.connectionsHasMore && (
          <p className="neuralLoadNote">
            Some relationships are outside this view; player profiles show direct connections.
          </p>
        )}
        {snapshot?.hasMore && (
          <button
            type="button"
            className="button secondary neuralLoadMore"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading network…' : 'Load more players'}
          </button>
        )}
        <form className="neuralSearch" onSubmit={searchPlayers}>
          <label className="visuallyHidden" htmlFor="neural-player-search">
            Search players by username
          </label>
          <input
            id="neural-player-search"
            autoComplete="off"
            maxLength={24}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find a player"
          />
          <button className="button secondary" type="submit" disabled={searching}>
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
        {searchResults.length > 0 && (
          <ul className="neuralSearchResults">
            {searchResults.map((result) => (
              <li key={result.id}>
                <button type="button" onClick={() => void loadPlayer(result.username)}>
                  <span>@{result.username}</span>
                  <span>{result.displayName || 'Player'}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {searchError && <p className="neuralSearchError" role="status">{searchError}</p>}
        <div className="neuralToolbar">
          <button type="button" className="button secondary" onClick={refreshNetwork}>
            Refresh
          </button>
          <button
            type="button"
            className={`button ${cameraMode === 'orbit' ? 'primary' : 'secondary'}`}
            aria-pressed={cameraMode === 'orbit'}
            onClick={() => setCameraMode('orbit')}
          >
            Orbit
          </button>
          <button
            type="button"
            className={`button ${cameraMode === 'flight' ? 'primary' : 'secondary'}`}
            aria-pressed={cameraMode === 'flight'}
            onClick={() => setCameraMode('flight')}
          >
            Free Flight
          </button>
          <button type="button" className="button secondary" onClick={resetView}>
            Reset view
          </button>
        </div>
        <p className="neuralControlsHint">
          Orbit: drag · pan: right-drag · zoom: scroll · mobile: one-finger orbit, two-finger pan/zoom.
          Free flight: focus the scene, then use WASD, Space and Shift.
        </p>
      </section>
      {selected && (
        <aside className="neuralPlayerPanel" aria-label={`Player ${selected.profile.username}`}>
          <button
            className="neuralPanelClose"
            type="button"
            aria-label="Return to network overview"
            onClick={resetView}
          >
            ×
          </button>
          <div className="tag">// PLAYER NODE</div>
          <ProceduralAvatar
            className="neuralPanelAvatar"
            seed={selected.profile.avatar_seed}
            version={selected.profile.avatar_generator_version}
            label={`${selected.profile.username} avatar`}
          />
          <h2>{selected.profile.display_name || selected.profile.username}</h2>
          <p className="profileUsername">@{selected.profile.username}</p>
          <dl className="neuralPlayerStats">
            <div><dt>Referrals</dt><dd>{selected.profile.referral_count}</dd></div>
            <div><dt>Connections</dt><dd>{selected.connectionCount}</dd></div>
            <div><dt>Interactions</dt><dd>{selected.interactionCount}</dd></div>
          </dl>
          <Link className="button secondary neuralProfileLink" href={profileHref(selected.profile.username)}>
            Open profile
          </Link>
          <h3>Direct connections</h3>
          {detailConnections.length === 0 ? (
            <p className="muted">No eligible gameplay connections yet.</p>
          ) : (
            <ul className="neuralConnectionList">
              {detailConnections.map((connection) => (
                <li key={`${connection.playerA}:${connection.playerB}`}>
                  <button
                    type="button"
                    onClick={() => void loadPlayer(connection.player.username)}
                  >
                    <ProceduralAvatar
                      className="neuralConnectionAvatar"
                      seed={connection.player.avatarSeed}
                      version={connection.player.avatarVersion}
                      label=""
                    />
                    <span className="neuralConnectionIdentity">
                      <strong>@{connection.player.username}</strong>
                      <small>Strength {connection.strength} · {connection.interactionCount} interactions</small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {selected.hasMoreConnections && (
            <p className="muted">Only the strongest 100 connections are shown here.</p>
          )}
        </aside>
      )}
      {systemSelected && <SystemNodePanel onClose={() => setSystemSelected(false)} />}
    </main>
  );
}
