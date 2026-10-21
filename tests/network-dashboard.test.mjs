import test from 'node:test';
import assert from 'node:assert/strict';
import { parseNetworkDashboard } from '../src/lib/network-dashboard.mjs';

test('network dashboard accepts real aggregate counts and ampersand usernames', () => {
  assert.deepEqual(
    parseNetworkDashboard({
      playerCount: 12,
      connectionCount: 20,
      interactionCount: 37,
      mostConnected: [{ username: 'Ampers&', displayName: 'Ampers', value: 8 }],
      mostInteractions: [{ username: 'Player_1', displayName: null, value: 14 }],
    }),
    {
      playerCount: 12,
      connectionCount: 20,
      interactionCount: 37,
      mostConnected: [{ username: 'Ampers&', displayName: 'Ampers', value: 8 }],
      mostInteractions: [{ username: 'Player_1', displayName: null, value: 14 }],
    },
  );
});

test('network dashboard rejects invalid counts, private fields, and malformed leaderboards', () => {
  const valid = {
    playerCount: 0,
    connectionCount: 0,
    interactionCount: 0,
    mostConnected: [],
    mostInteractions: [],
  };
  assert.equal(parseNetworkDashboard({ ...valid, connectionCount: -1 }), null);
  assert.equal(parseNetworkDashboard({ ...valid, mostConnected: Array(6).fill({ username: 'Player_1', displayName: null, value: 0 }) }), null);
  assert.equal(parseNetworkDashboard({ ...valid, mostInteractions: [{ username: 'private@example.com', displayName: null, value: 1 }] }), null);
});
