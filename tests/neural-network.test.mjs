import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalPlayerPair,
  connectionRadius,
} from '../src/lib/neural/geometry.mjs';

const playerA = '00000000-0000-0000-0000-000000000001';
const playerB = '00000000-0000-0000-0000-000000000002';

test('neural connection pairs are canonical and undirected', () => {
  assert.deepEqual(canonicalPlayerPair(playerA, playerB), {
    playerA,
    playerB,
  });
  assert.deepEqual(canonicalPlayerPair(playerB, playerA), {
    playerA,
    playerB,
  });
});

test('connection width respects the configured visual strength cap', () => {
  assert.ok(Math.abs(connectionRadius(1, 20) - 0.03975) < Number.EPSILON);
  assert.equal(connectionRadius(20, 20), 0.13);
  assert.equal(connectionRadius(200, 20), 0.13);
  assert.throws(() => connectionRadius(0), RangeError);
});

test('a player cannot connect to itself or an invalid player identifier', () => {
  assert.throws(() => canonicalPlayerPair(playerA, playerA), TypeError);
  assert.throws(() => canonicalPlayerPair('not-a-uuid', playerB), TypeError);
});
