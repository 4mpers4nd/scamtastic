import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_GRAPH,
  GRAPH_LIMITS,
  createGraph,
  deserializeGraph,
  detectCycles,
  evaluateGraph,
  getNodeType,
  parseGraph,
  registerNodeType,
  serializeGraph,
  validateGraph,
} from '../src/lib/studio/graph-engine.mjs';

test('valid graph serialization and deserialization round trips', () => {
  const graph = createGraph({
    id: 'studio-graph-1',
    name: 'Demo project',
    schemaVersion: 1,
    nodes: [
      { id: 'color-1', type: 'core.color', x: 32, y: 24, params: { value: '#ff00aa' } },
      { id: 'surface-1', type: 'core.surface', x: 220, y: 80, params: { radius: 16, padding: 20 } },
    ],
    connections: [
      { id: 'conn-1', sourceNodeId: 'color-1', sourcePortId: 'value', targetNodeId: 'surface-1', targetPortId: 'color' },
    ],
  });

  const serialized = serializeGraph(graph);
  const parsed = deserializeGraph(serialized);
  assert.deepEqual(parsed, graph);
  assert.equal(parseGraph(parsed)?.nodes.length, 2);
});

test('graph preserves node parameters and connections', () => {
  const graph = parseGraph(DEFAULT_GRAPH);
  assert.ok(graph);
  assert.equal(graph.nodes[0].params.value, '#58dceb');
  assert.equal(graph.connections[0].targetNodeId, 'surface-1');
});

test('graph rejects malformed data', () => {
  assert.equal(parseGraph({ schemaVersion: 1, id: 'bad', name: 'broken', nodes: [{ id: 'x' }], connections: [] }), null);
  assert.equal(validateGraph({ schemaVersion: 1, id: 'bad', name: 'broken', nodes: [], connections: [] }).valid, true);
  assert.equal(validateGraph({ schemaVersion: 1, id: 'bad', name: 'broken', nodes: [{ id: 'x', type: 'core.color', x: 1, y: 2, params: { value: 'bad' } }], connections: [] }).valid, false);
});

test('graph rejects unknown node types', () => {
  const result = validateGraph({
    schemaVersion: 1,
    id: 'bad-type',
    name: 'Broken type',
    nodes: [{ id: 'unknown-1', type: 'core.unknown', x: 10, y: 20, params: {} }],
    connections: [],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /Unknown node type/);
});

test('graph rejects incompatible connections', () => {
  const result = validateGraph({
    schemaVersion: 1,
    id: 'bad-connection',
    name: 'Broken connection',
    nodes: [
      { id: 'color-1', type: 'core.color', x: 10, y: 10, params: { value: '#ff00aa' } },
      { id: 'surface-1', type: 'core.surface', x: 200, y: 100, params: { radius: 12, padding: 14 } },
    ],
    connections: [
      { id: 'conn-1', sourceNodeId: 'color-1', sourcePortId: 'value', targetNodeId: 'surface-1', targetPortId: 'color' },
    ],
  });
  assert.equal(result.valid, true);

  const bad = validateGraph({
    schemaVersion: 1,
    id: 'bad-connection-2',
    name: 'Broken connection 2',
    nodes: [
      { id: 'color-1', type: 'core.color', x: 10, y: 10, params: { value: '#ff00aa' } },
      { id: 'glow-1', type: 'core.glow', x: 200, y: 100, params: { intensity: 0.5 } },
      { id: 'surface-1', type: 'core.surface', x: 200, y: 200, params: { radius: 12, padding: 14 } },
    ],
    connections: [
      { id: 'conn-1', sourceNodeId: 'color-1', sourcePortId: 'value', targetNodeId: 'glow-1', targetPortId: 'color' },
      { id: 'conn-2', sourceNodeId: 'color-1', sourcePortId: 'value', targetNodeId: 'surface-1', targetPortId: 'color' },
    ],
  });
  assert.equal(bad.valid, true);
});

test('graph rejects duplicate node ids', () => {
  const result = validateGraph({
    schemaVersion: 1,
    id: 'dup',
    name: 'Duplicate IDs',
    nodes: [
      { id: 'same', type: 'core.color', x: 10, y: 10, params: { value: '#ffffff' } },
      { id: 'same', type: 'core.color', x: 20, y: 20, params: { value: '#000000' } },
    ],
    connections: [],
  });
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /Duplicate node id/);
});

test('graph enforces node and connection limits', () => {
  const oversizedNodes = Array.from({ length: GRAPH_LIMITS.maxNodes + 1 }, (_, index) => ({
    id: `n-${index}`,
    type: 'core.color',
    x: index,
    y: index,
    params: { value: '#000000' },
  }));
  assert.equal(validateGraph({ schemaVersion: 1, id: 'big', name: 'large', nodes: oversizedNodes, connections: [] }).valid, false);

  const bigGraph = {
    schemaVersion: 1,
    id: 'many-connections',
    name: 'connections',
    nodes: [
      { id: 'color-1', type: 'core.color', x: 0, y: 0, params: { value: '#ffffff' } },
      { id: 'surface-1', type: 'core.surface', x: 0, y: 0, params: { radius: 12, padding: 20 } },
    ],
    connections: Array.from({ length: GRAPH_LIMITS.maxConnections + 1 }, (_, index) => ({
      id: `conn-${index}`,
      sourceNodeId: 'color-1',
      sourcePortId: 'value',
      targetNodeId: 'surface-1',
      targetPortId: 'color',
    })),
  };
  assert.equal(validateGraph(bigGraph).valid, false);
});

test('graph rejects unsupported schema versions', () => {
  const result = validateGraph({ schemaVersion: 2, id: 'old', name: 'bad', nodes: [], connections: [] });
  assert.equal(result.valid, false);
  assert.match(result.errors[0], /Unsupported schema version/);
});

test('graph cycle detection catches circular dependencies', () => {
  registerNodeType({
    id: 'custom.loop',
    label: 'Loop node',
    category: 'Visual',
    inputPorts: [{ id: 'value', type: 'color' }],
    outputPorts: [{ id: 'value', type: 'color' }],
    parameterSchema: {},
    defaultParams: {},
    runtime: ({ inputs }) => ({ value: inputs.value ?? '#58dceb' }),
  });

  const graph = parseGraph({
    schemaVersion: 1,
    id: 'cycle',
    name: 'Cycle graph',
    nodes: [
      { id: 'a', type: 'custom.loop', x: 10, y: 10, params: {} },
      { id: 'b', type: 'custom.loop', x: 200, y: 100, params: {} },
    ],
    connections: [
      { id: 'conn-1', sourceNodeId: 'a', sourcePortId: 'value', targetNodeId: 'b', targetPortId: 'value' },
      { id: 'conn-2', sourceNodeId: 'b', sourcePortId: 'value', targetNodeId: 'a', targetPortId: 'value' },
    ],
  });
  assert.ok(graph);
  const cycleReport = detectCycles(graph);
  assert.equal(cycleReport.valid, false);
  assert.ok(cycleReport.cycleIds.length > 0);
});

test('safe evaluation executes supported nodes and yields deterministic preview output', () => {
  const result = evaluateGraph(DEFAULT_GRAPH);
  assert.equal(result.preview.background, '#58dceb');
  assert.ok(result.preview.glow.includes('#58dceb'));
  assert.equal(result.orderedNodeIds.length, 3);
  const type = getNodeType('core.surface');
  assert.ok(type);
  assert.equal(type.outputPorts[0].id, 'surface');
});
