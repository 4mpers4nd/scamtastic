const GRAPH_SCHEMA_VERSION = 1;
const MAX_GRAPH_NODES = 64;
const MAX_CONNECTIONS = 128;
const MAX_SERIALIZED_BYTES = 256 * 1024;
const COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const NODE_TYPES = new Map();

function assertPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeIdentifier(value, fieldName) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) {
    throw new Error(`${fieldName} must be a non-empty string under 128 characters`);
  }
  return value;
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateColor(value) {
  return typeof value === 'string' && COLOR_PATTERN.test(value);
}

function validateParameterValue(schema, value) {
  if (!schema) return true;
  if (schema.type === 'string') {
    if (typeof value !== 'string') return false;
    if (typeof schema.maxLength === 'number' && value.length > schema.maxLength) return false;
    return true;
  }
  if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
    if (typeof schema.min === 'number' && value < schema.min) return false;
    if (typeof schema.max === 'number' && value > schema.max) return false;
    return true;
  }
  if (schema.type === 'boolean') {
    return typeof value === 'boolean';
  }
  if (schema.type === 'color') {
    return validateColor(value);
  }
  return false;
}

function buildParameterError(type, key, nodeId) {
  if (nodeId) {
    return `Parameter "${key}" on node "${nodeId}" is invalid for node type "${type.id}"`;
  }
  return `Parameter "${key}" for node type "${type.id}" is invalid`;
}

function normalizeParams(type, params, nodeId = null) {
  const config = type.parameterSchema ?? {};
  const merged = { ...type.defaultParams };
  const source = assertPlainObject(params) ? params : {};

  for (const [key, value] of Object.entries(source)) {
    if (!(key in config)) {
      throw new Error(`Unknown parameter "${key}" for node type "${type.id}"`);
    }
    if (!validateParameterValue(config[key], value)) {
      throw new Error(buildParameterError(type, key, nodeId));
    }
    merged[key] = value;
  }

  for (const [key, schema] of Object.entries(config)) {
    if (!(key in merged)) {
      throw new Error(`Missing required parameter "${key}" for node type "${type.id}"`);
    }
    if (!validateParameterValue(schema, merged[key])) {
      throw new Error(buildParameterError(type, key, nodeId));
    }
  }

  return merged;
}

function normalizePortDefinition(port, portKind) {
  if (!assertPlainObject(port)) {
    throw new Error(`${portKind} port definition must be an object`);
  }
  const id = normalizeIdentifier(port.id, `${portKind} port id`);
  const type = normalizeIdentifier(port.type, `${portKind} port type`);
  return { id, type };
}

export function registerNodeType(definition) {
  if (!assertPlainObject(definition)) {
    throw new Error('Node type definition must be an object');
  }

  const id = normalizeIdentifier(definition.id, 'Node type id');
  const label = typeof definition.label === 'string' && definition.label.trim().length > 0 ? definition.label.trim() : id;
  const category = typeof definition.category === 'string' && definition.category.trim().length > 0 ? definition.category.trim() : 'Visual';
  const inputPorts = Array.isArray(definition.inputPorts) ? definition.inputPorts.map((port) => normalizePortDefinition(port, 'Input')) : [];
  const outputPorts = Array.isArray(definition.outputPorts) ? definition.outputPorts.map((port) => normalizePortDefinition(port, 'Output')) : [];
  const parameterSchema = assertPlainObject(definition.parameterSchema) ? definition.parameterSchema : {};
  const defaultParams = assertPlainObject(definition.defaultParams) ? { ...definition.defaultParams } : {};

  if (NODE_TYPES.has(id)) {
    throw new Error(`Node type "${id}" is already registered`);
  }

  const normalizedType = {
    id,
    label,
    category,
    inputPorts,
    outputPorts,
    parameterSchema,
    defaultParams,
    runtime: typeof definition.runtime === 'function' ? definition.runtime : () => ({}),
  };

  NODE_TYPES.set(id, normalizedType);
  return normalizedType;
}

export function listNodeTypes() {
  return [...NODE_TYPES.values()].sort((left, right) => left.category.localeCompare(right.category) || left.label.localeCompare(right.label));
}

export function getNodeType(typeId) {
  return NODE_TYPES.get(typeId) ?? null;
}

registerNodeType({
  id: 'core.color',
  label: 'Color',
  category: 'Visual',
  outputPorts: [{ id: 'value', type: 'color' }],
  parameterSchema: { value: { type: 'color' } },
  defaultParams: { value: '#58dceb' },
  runtime: ({ params }) => ({ value: params.value }),
});

registerNodeType({
  id: 'core.surface',
  label: 'Background',
  category: 'Visual',
  inputPorts: [{ id: 'color', type: 'color' }],
  outputPorts: [{ id: 'surface', type: 'surface' }],
  parameterSchema: {
    radius: { type: 'number', min: 0, max: 64 },
    padding: { type: 'number', min: 0, max: 120 },
  },
  defaultParams: { radius: 18, padding: 20 },
  runtime: ({ inputs, params }) => ({
    surface: {
      background: inputs.color ?? '#0d1117',
      radius: params.radius,
      padding: params.padding,
    },
  }),
});

registerNodeType({
  id: 'core.glow',
  label: 'Glow',
  category: 'Visual',
  inputPorts: [{ id: 'color', type: 'color' }],
  outputPorts: [{ id: 'style', type: 'style' }],
  parameterSchema: { intensity: { type: 'number', min: 0, max: 1 } },
  defaultParams: { intensity: 0.72 },
  runtime: ({ inputs, params }) => ({
    style: {
      shadow: `0 0 ${18 + params.intensity * 26}px ${inputs.color ?? '#58dceb'}`,
      accent: inputs.color ?? '#58dceb',
    },
  }),
});

export function createGraph(options = {}) {
  const id = normalizeIdentifier(options.id ?? 'studio-project', 'Graph id');
  const name = typeof options.name === 'string' && options.name.trim().length > 0 ? options.name.trim() : 'New studio project';
  const nodes = Array.isArray(options.nodes) ? options.nodes : [];
  const connections = Array.isArray(options.connections) ? options.connections : [];
  return normalizeGraph({
    id,
    name,
    schemaVersion: GRAPH_SCHEMA_VERSION,
    nodes,
    connections,
  });
}

export function parseGraph(value) {
  try {
    return normalizeGraph(value);
  } catch {
    return null;
  }
}

export function validateGraph(value) {
  try {
    const graph = normalizeGraph(value);
    return { valid: true, errors: [], graph };
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Invalid graph data'],
      graph: null,
    };
  }
}

function normalizeGraph(value) {
  if (!assertPlainObject(value)) {
    throw new Error('Graph data must be an object');
  }

  if (value.schemaVersion !== GRAPH_SCHEMA_VERSION) {
    throw new Error(`Unsupported schema version: ${String(value.schemaVersion)}`);
  }

  const id = normalizeIdentifier(value.id ?? 'studio-project', 'Graph id');
  const name = typeof value.name === 'string' && value.name.trim().length > 0 ? value.name.trim() : 'Studio project';
  const nodesInput = Array.isArray(value.nodes) ? value.nodes : [];
  const connectionsInput = Array.isArray(value.connections) ? value.connections : [];

  if (nodesInput.length > MAX_GRAPH_NODES) {
    throw new Error(`Graph exceeds ${MAX_GRAPH_NODES} node limit`);
  }
  if (connectionsInput.length > MAX_CONNECTIONS) {
    throw new Error(`Graph exceeds ${MAX_CONNECTIONS} connection limit`);
  }

  const nodes = nodesInput.map((node, index) => {
    if (!assertPlainObject(node)) {
      throw new Error(`Node at index ${index} must be an object`);
    }
    const nodeId = normalizeIdentifier(node.id ?? `node-${index}`, `Node id`);
    const typeId = normalizeIdentifier(node.type ?? '', 'Node type');
    const type = NODE_TYPES.get(typeId);
    if (!type) {
      throw new Error(`Unknown node type "${typeId}"`);
    }

    const x = isFiniteNumber(node.x) ? node.x : 0;
    const y = isFiniteNumber(node.y) ? node.y : 0;
    const params = normalizeParams(type, node.params ?? {});

    return {
      id: nodeId,
      type: typeId,
      x,
      y,
      params,
    };
  });

  const uniqueNodeIds = new Set();
  for (const node of nodes) {
    if (uniqueNodeIds.has(node.id)) {
      throw new Error(`Duplicate node id "${node.id}"`);
    }
    uniqueNodeIds.add(node.id);
  }

  const connections = connectionsInput.map((connection, index) => {
    if (!assertPlainObject(connection)) {
      throw new Error(`Connection at index ${index} must be an object`);
    }
    const connectionId = normalizeIdentifier(connection.id ?? `connection-${index}`, 'Connection id');
    const sourceNodeId = normalizeIdentifier(connection.sourceNodeId ?? '', 'Source node id');
    const targetNodeId = normalizeIdentifier(connection.targetNodeId ?? '', 'Target node id');
    const sourcePortId = normalizeIdentifier(connection.sourcePortId ?? '', 'Source port id');
    const targetPortId = normalizeIdentifier(connection.targetPortId ?? '', 'Target port id');

    const sourceNode = nodes.find((node) => node.id === sourceNodeId);
    const targetNode = nodes.find((node) => node.id === targetNodeId);
    if (!sourceNode || !targetNode) {
      throw new Error(`Connection references missing nodes: ${sourceNodeId} -> ${targetNodeId}`);
    }

    const sourceType = NODE_TYPES.get(sourceNode.type);
    const targetType = NODE_TYPES.get(targetNode.type);
    if (!sourceType || !targetType) {
      throw new Error('Connection references an unregistered node type');
    }

    const sourcePort = sourceType.outputPorts.find((port) => port.id === sourcePortId);
    const targetPort = targetType.inputPorts.find((port) => port.id === targetPortId);
    if (!sourcePort || !targetPort) {
      throw new Error(`Connection ports do not exist on nodes: ${sourceNodeId}:${sourcePortId} -> ${targetNodeId}:${targetPortId}`);
    }
    if (sourcePort.type !== targetPort.type) {
      throw new Error(`Incompatible connection types: ${sourcePort.type} -> ${targetPort.type}`);
    }

    return {
      id: connectionId,
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId,
    };
  });

  const seenConnections = new Set();
  for (const connection of connections) {
    const key = `${connection.sourceNodeId}:${connection.sourcePortId}->${connection.targetNodeId}:${connection.targetPortId}`;
    if (seenConnections.has(key)) {
      throw new Error(`Duplicate connection ${key}`);
    }
    seenConnections.add(key);
  }

  const normalizedGraph = {
    id,
    name,
    schemaVersion: GRAPH_SCHEMA_VERSION,
    nodes: nodes.slice().sort((left, right) => left.id.localeCompare(right.id)),
    connections: connections.slice().sort((left, right) => left.id.localeCompare(right.id)),
  };

  const payloadString = JSON.stringify(normalizedGraph);
  if (payloadString.length > MAX_SERIALIZED_BYTES) {
    throw new Error(`Graph exceeds storage size limit (${MAX_SERIALIZED_BYTES} bytes)`);
  }

  return normalizedGraph;
}

export function serializeGraph(graph) {
  const normalized = normalizeGraph(graph);
  return JSON.stringify(normalized, null, 2);
}

export function deserializeGraph(serializedGraph) {
  if (typeof serializedGraph !== 'string' || serializedGraph.trim().length === 0) {
    throw new Error('Serialized graph must be a non-empty string');
  }
  try {
    const parsed = JSON.parse(serializedGraph);
    return normalizeGraph(parsed);
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : 'Unable to deserialize graph');
  }
}

export function canConnect(graph, sourceNodeId, sourcePortId, targetNodeId, targetPortId) {
  const normalized = parseGraph(graph);
  if (!normalized) return false;
  const sourceNode = normalized.nodes.find((node) => node.id === sourceNodeId);
  const targetNode = normalized.nodes.find((node) => node.id === targetNodeId);
  if (!sourceNode || !targetNode) return false;

  const sourceType = getNodeType(sourceNode.type);
  const targetType = getNodeType(targetNode.type);
  if (!sourceType || !targetType) return false;

  const sourcePort = sourceType.outputPorts.find((port) => port.id === sourcePortId);
  const targetPort = targetType.inputPorts.find((port) => port.id === targetPortId);
  if (!sourcePort || !targetPort) return false;

  if (sourcePort.type !== targetPort.type) return false;

  return !normalized.connections.some(
    (connection) =>
      connection.sourceNodeId === sourceNodeId &&
      connection.sourcePortId === sourcePortId &&
      connection.targetNodeId === targetNodeId &&
      connection.targetPortId === targetPortId,
  );
}

export function detectCycles(graph) {
  const normalized = parseGraph(graph);
  if (!normalized) {
    return { valid: false, cycleIds: [] };
  }

  const indegree = new Map();
  const adjacency = new Map();
  for (const node of normalized.nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const connection of normalized.connections) {
    if (connection.sourceNodeId === connection.targetNodeId) {
      return { valid: false, cycleIds: [connection.sourceNodeId] };
    }
    indegree.set(connection.targetNodeId, (indegree.get(connection.targetNodeId) ?? 0) + 1);
    adjacency.get(connection.sourceNodeId).push(connection.targetNodeId);
  }

  const queue = [...normalized.nodes]
    .map((node) => node.id)
    .filter((nodeId) => indegree.get(nodeId) === 0);

  let visited = 0;
  while (queue.length > 0) {
    const currentId = queue.shift();
    visited += 1;
    for (const neighborId of adjacency.get(currentId) ?? []) {
      indegree.set(neighborId, (indegree.get(neighborId) ?? 0) - 1);
      if ((indegree.get(neighborId) ?? 0) === 0) {
        queue.push(neighborId);
      }
    }
  }

  const cycleIds = normalized.nodes
    .map((node) => node.id)
    .filter((nodeId) => indegree.get(nodeId) > 0);

  return {
    valid: visited === normalized.nodes.length,
    cycleIds,
  };
}

export function evaluateGraph(graph) {
  const normalized = parseGraph(graph);
  if (!normalized) {
    throw new Error('Graph data is invalid and cannot be evaluated');
  }

  const cycleReport = detectCycles(normalized);
  if (!cycleReport.valid) {
    throw new Error(`Graph contains a cycle: ${cycleReport.cycleIds.join(', ') || 'unknown'}`);
  }

  const orderedNodeIds = [];
  const indegree = new Map();
  const adjacency = new Map();

  for (const node of normalized.nodes) {
    indegree.set(node.id, 0);
    adjacency.set(node.id, []);
  }

  for (const connection of normalized.connections) {
    indegree.set(connection.targetNodeId, (indegree.get(connection.targetNodeId) ?? 0) + 1);
    adjacency.get(connection.sourceNodeId).push(connection.targetNodeId);
  }

  const queue = [...normalized.nodes]
    .map((node) => node.id)
    .filter((nodeId) => (indegree.get(nodeId) ?? 0) === 0)
    .sort();

  while (queue.length > 0) {
    const currentId = queue.shift();
    orderedNodeIds.push(currentId);
    for (const neighborId of adjacency.get(currentId) ?? []) {
      indegree.set(neighborId, (indegree.get(neighborId) ?? 0) - 1);
      if ((indegree.get(neighborId) ?? 0) === 0) {
        queue.push(neighborId);
        queue.sort();
      }
    }
  }

  if (orderedNodeIds.length !== normalized.nodes.length) {
    throw new Error('Graph cannot be evaluated because it contains a cycle');
  }

  const outputsByNode = new Map();

  for (const nodeId of orderedNodeIds) {
    const node = normalized.nodes.find((candidate) => candidate.id === nodeId);
    const type = getNodeType(node.type);
    const inputs = {};

    for (const connection of normalized.connections.filter((candidate) => candidate.targetNodeId === nodeId)) {
      const sourceValue = outputsByNode.get(connection.sourceNodeId)?.[connection.sourcePortId];
      if (sourceValue === undefined) {
        throw new Error(`Missing source value for ${connection.sourceNodeId}:${connection.sourcePortId}`);
      }
      inputs[connection.targetPortId] = sourceValue;
    }

    const result = type.runtime({ graph: normalized, node, params: node.params, inputs });
    if (!assertPlainObject(result)) {
      throw new Error(`Node type "${type.id}" produced an invalid runtime payload`);
    }

    outputsByNode.set(nodeId, result);
  }

  const preview = { background: '#0d1117', accent: '#58dceb', glow: '0 0 22px #58dceb' };
  const colorNodes = [...normalized.nodes].filter((node) => node.type === 'core.color');
  if (colorNodes.length > 0) {
    const sourceColor = colorNodes[0].params.value;
    preview.background = sourceColor;
    preview.accent = sourceColor;
  }

  const surfaceNodes = normalized.nodes.filter((node) => node.type === 'core.surface');
  if (surfaceNodes.length > 0) {
    const node = surfaceNodes[0];
    const incoming = normalized.connections.find(
      (connection) => connection.targetNodeId === node.id && connection.targetPortId === 'color',
    );
    if (incoming) {
      const sourceValue = outputsByNode.get(incoming.sourceNodeId)?.[incoming.sourcePortId];
      if (typeof sourceValue === 'string') {
        preview.background = sourceValue;
        preview.accent = sourceValue;
      }
    }
  }

  const glowNodes = normalized.nodes.filter((node) => node.type === 'core.glow');
  if (glowNodes.length > 0) {
    const glowNode = glowNodes[0];
    const incoming = normalized.connections.find(
      (connection) => connection.targetNodeId === glowNode.id && connection.targetPortId === 'color',
    );
    const intensity = typeof glowNode.params.intensity === 'number' ? glowNode.params.intensity : 0.72;
    const glowColor = incoming ? outputsByNode.get(incoming.sourceNodeId)?.[incoming.sourcePortId] : preview.accent;
    if (typeof glowColor === 'string') {
      preview.glow = `0 0 ${18 + intensity * 30}px ${glowColor}`;
    }
  }

  return {
    preview,
    outputs: outputsByNode,
    orderedNodeIds,
  };
}

export const GRAPH_LIMITS = {
  maxNodes: MAX_GRAPH_NODES,
  maxConnections: MAX_CONNECTIONS,
  maxSerializedBytes: MAX_SERIALIZED_BYTES,
  schemaVersion: GRAPH_SCHEMA_VERSION,
};

export const DEFAULT_GRAPH = {
  id: 'studio-demo-project',
  name: 'Glitch surface',
  schemaVersion: GRAPH_SCHEMA_VERSION,
  nodes: [
    { id: 'color-1', type: 'core.color', x: 90, y: 90, params: { value: '#58dceb' } },
    { id: 'surface-1', type: 'core.surface', x: 350, y: 90, params: { radius: 22, padding: 24 } },
    { id: 'glow-1', type: 'core.glow', x: 350, y: 250, params: { intensity: 0.8 } },
  ],
  connections: [
    { id: 'connection-1', sourceNodeId: 'color-1', sourcePortId: 'value', targetNodeId: 'surface-1', targetPortId: 'color' },
    { id: 'connection-2', sourceNodeId: 'color-1', sourcePortId: 'value', targetNodeId: 'glow-1', targetPortId: 'color' },
  ],
};
