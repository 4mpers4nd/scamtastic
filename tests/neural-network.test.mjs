import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalPlayerPair,
  connectionRadius,
  initialNeuralView,
} from '../src/lib/neural/geometry.mjs';
import { createFrameLoop } from '../src/lib/neural/frame-loop.mjs';

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

test('an isolated neuron at the origin receives a visible initial camera view', () => {
  const view = initialNeuralView([
    { id: playerA, username: 'Ampers&', x: 0, y: 0, z: 0 },
  ]);

  assert.deepEqual(view.target, { x: 0, y: 0, z: 0 });
  assert.equal(view.distance, 21.6);
  assert.ok(view.distance > 0);
});

test('frame loop renders its first scheduled frame and can schedule another', () => {
  const callbacks = new Map();
  let nextFrame = 0;
  let renders = 0;
  const loop = createFrameLoop(
    () => {
      renders += 1;
      return renders === 1;
    },
    (callback) => {
      const id = ++nextFrame;
      callbacks.set(id, callback);
      return id;
    },
    (id) => callbacks.delete(id),
  );

  loop.schedule();
  assert.equal(callbacks.size, 1);
  const firstFrame = callbacks.get(1);
  callbacks.delete(1);
  firstFrame(16);
  assert.equal(renders, 1);
  assert.equal(callbacks.size, 1);
  const secondFrame = callbacks.get(2);
  callbacks.delete(2);
  secondFrame(32);
  assert.equal(renders, 2);
  assert.equal(callbacks.size, 0);

  loop.dispose();
});

test('disposing the frame loop cancels a pending render', () => {
  let scheduledFrame;
  const cancelledFrames = [];
  const loop = createFrameLoop(
    () => false,
    (callback) => {
      scheduledFrame = callback;
      return 7;
    },
    (frame) => cancelledFrames.push(frame),
  );

  loop.schedule();
  loop.dispose();
  scheduledFrame(16);

  assert.deepEqual(cancelledFrames, [7]);
});
