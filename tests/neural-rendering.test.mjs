import assert from 'node:assert/strict';
import test from 'node:test';
import { NEURAL_RENDERING, SYSTEM_NODE } from '../src/lib/neural/rendering.mjs';
import { initialNeuralView } from '../src/lib/neural/geometry.mjs';

test('neural palette uses configured white player nodes and slate backgrounds', () => {
  assert.equal(NEURAL_RENDERING.background, 0x111c29);
  assert.equal(NEURAL_RENDERING.backgroundCenter, 0x1a2b3b);
  assert.equal(NEURAL_RENDERING.playerCore, 0xf5fbff);
  assert.equal(NEURAL_RENDERING.playerGlow, 0x9beaff);
});

test('system neuron is a distinct render-only entity at the origin', () => {
  assert.equal(SYSTEM_NODE.id, 'scamtastic-system');
  assert.deepEqual([SYSTEM_NODE.x, SYSTEM_NODE.y, SYSTEM_NODE.z], [0, 0, 0]);
  assert.equal(SYSTEM_NODE.classification, 'SYSTEM');
});

test('a one-player origin scene remains framed with the system neuron', () => {
  const view = initialNeuralView([
    { id: 'player-1', username: 'Ampers&', x: 0, y: 0, z: 0 },
    { id: SYSTEM_NODE.id, x: SYSTEM_NODE.x, y: SYSTEM_NODE.y, z: SYSTEM_NODE.z },
  ]);
  assert.deepEqual(view.target, { x: 0, y: 0, z: 0 });
  assert.ok(view.distance > 0);
});
