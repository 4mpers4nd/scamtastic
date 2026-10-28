'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_GRAPH,
  canConnect,
  deserializeGraph,
  evaluateGraph,
  getNodeType,
  listNodeTypes,
  parseGraph,
  serializeGraph,
  validateGraph,
} from '@/lib/studio/graph-engine.mjs';

type GraphNode = {
  id: string;
  type: string;
  x: number;
  y: number;
  params: Record<string, unknown>;
};

type GraphConnection = {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
};

type GraphDocument = {
  id: string;
  name: string;
  schemaVersion: number;
  nodes: GraphNode[];
  connections: GraphConnection[];
};

type PendingConnection = {
  nodeId: string;
  portId: string;
};

const STORAGE_KEY = 'scamtastic-studio-saved-projects';

function makeNodeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function cloneGraph(graph: GraphDocument): GraphDocument {
  return JSON.parse(JSON.stringify(graph)) as GraphDocument;
}

function coerceNodeParamValue(schema: { type?: string; min?: number; max?: number } | undefined, value: string | number | boolean | null | undefined) {
  if (!schema) {
    return value ?? '';
  }

  if (schema.type === 'number') {
    if (typeof value === 'string' && value.trim() === '') {
      return null;
    }
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      return null;
    }
    if (typeof schema.min === 'number' && numericValue < schema.min) {
      return null;
    }
    if (typeof schema.max === 'number' && numericValue > schema.max) {
      return null;
    }
    return numericValue;
  }

  if (schema.type === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'true' || value === '1';
    return null;
  }

  if (schema.type === 'color') {
    return typeof value === 'string' ? value : String(value ?? '');
  }

  return typeof value === 'string' ? value : String(value ?? '');
}

export default function StudioEditor() {
  const [graph, setGraph] = useState<GraphDocument>(() => cloneGraph(parseGraph(DEFAULT_GRAPH) ?? DEFAULT_GRAPH));
  const [pendingConnection, setPendingConnection] = useState<PendingConnection | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [savedProjects, setSavedProjects] = useState<Array<{ id: string; name: string; updatedAt: string; graph: string }>>([]);
  const historyRef = useRef<string[]>([serializeGraph(parseGraph(DEFAULT_GRAPH) ?? DEFAULT_GRAPH)]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [dragging, setDragging] = useState<{ nodeId: string; pointerX: number; pointerY: number; startX: number; startY: number } | null>(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const projects = JSON.parse(raw) as Array<{ id: string; name: string; updatedAt: string; graph: string }>;
      if (Array.isArray(projects)) {
        setSavedProjects(projects);
      }
    } catch {
      // Intentionally ignore malformed saved projects.
    }
  }, []);

  useEffect(() => {
    if (!selectedNodeId && graph.nodes.length > 0) {
      setSelectedNodeId(graph.nodes[0].id);
    }
  }, [graph, selectedNodeId]);

  useEffect(() => {
    if (!dragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      setGraph((previous) => {
        const next = cloneGraph(previous);
        const node = next.nodes.find((candidate) => candidate.id === dragging.nodeId);
        if (!node) return previous;

        const deltaX = (event.clientX - dragging.pointerX) / 1.5;
        const deltaY = (event.clientY - dragging.pointerY) / 1.5;
        node.x = dragging.startX + deltaX;
        node.y = dragging.startY + deltaY;
        return next;
      });
    };

    const handlePointerUp = () => {
      setDragging(null);
      setGraph((previous) => {
        const normalized = parseGraph(previous);
        if (!normalized) return previous;
        const serialized = serializeGraph(normalized);
        historyRef.current = [...historyRef.current.slice(0, historyIndex + 1), serialized].slice(-20);
        setHistoryIndex(historyRef.current.length - 1);
        return normalized;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragging, historyIndex]);

  const selectedNode = graph.nodes.find((node) => node.id === selectedNodeId) ?? null;
  const validation = useMemo(() => validateGraph(graph), [graph]);
  const preview = useMemo(() => {
    try {
      return evaluateGraph(graph).preview;
    } catch {
      return { background: '#0d1117', accent: '#58dceb', glow: '0 0 22px #58dceb' };
    }
  }, [graph]);

  const commitGraph = (nextGraph: GraphDocument) => {
    const normalized = parseGraph(nextGraph);
    if (!normalized) return;
    const serialized = serializeGraph(normalized);
    historyRef.current = [...historyRef.current.slice(0, historyIndex + 1), serialized].slice(-20);
    setHistoryIndex(historyRef.current.length - 1);
    setGraph(normalized);
  };

  const addNode = (nodeTypeId: string) => {
    const type = getNodeType(nodeTypeId);
    if (!type) return;
    const nextNode: GraphNode = {
      id: makeNodeId(nodeTypeId.split('.').at(-1) ?? 'node'),
      type: nodeTypeId,
      x: 120 + graph.nodes.length * 42,
      y: 90 + graph.nodes.length * 26,
      params: { ...type.defaultParams },
    };
    commitGraph({ ...graph, nodes: [...graph.nodes, nextNode] });
  };

  const updateNodeParam = (nodeId: string, key: string, value: string | number | boolean) => {
    setGraph((previous) => {
      const next = cloneGraph(previous);
      const node = next.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return previous;

      const type = getNodeType(node.type);
      const schema = type?.parameterSchema?.[key];
      const nextValue = coerceNodeParamValue(schema, value);

      if (nextValue === null) {
        return previous;
      }

      node.params[key] = nextValue as GraphNode['params'][string];

      const normalized = parseGraph(next);
      if (!normalized) {
        return previous;
      }

      return normalized;
    });
  };

  const removeNode = (nodeId: string) => {
    const nextGraph = {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== nodeId),
      connections: graph.connections.filter(
        (connection) =>
          connection.sourceNodeId !== nodeId && connection.targetNodeId !== nodeId,
      ),
    };
    commitGraph(nextGraph);
    setSelectedNodeId(null);
  };

  const removeConnection = (connectionId: string) => {
    commitGraph({
      ...graph,
      connections: graph.connections.filter((connection) => connection.id !== connectionId),
    });
  };

  const startConnection = (nodeId: string, portId: string) => {
    if (pendingConnection && pendingConnection.nodeId === nodeId && pendingConnection.portId === portId) {
      setPendingConnection(null);
      return;
    }
    setPendingConnection({ nodeId, portId });
  };

  const finishConnection = (nodeId: string, portId: string) => {
    if (!pendingConnection) return;
    const sourceNodeId = pendingConnection.nodeId;
    const sourcePortId = pendingConnection.portId;
    const targetNodeId = nodeId;
    const targetPortId = portId;

    if (sourceNodeId === targetNodeId) {
      setPendingConnection(null);
      return;
    }

    if (!canConnect(graph, sourceNodeId, sourcePortId, targetNodeId, targetPortId)) {
      setPendingConnection(null);
      return;
    }

    commitGraph({
      ...graph,
      connections: [
        ...graph.connections,
        {
          id: makeNodeId('connection'),
          sourceNodeId,
          sourcePortId,
          targetNodeId,
          targetPortId,
        },
      ],
    });
    setPendingConnection(null);
  };

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const nextIndex = historyIndex - 1;
    const previous = deserializeGraph(historyRef.current[nextIndex]);
    setHistoryIndex(nextIndex);
    if (previous) {
      setGraph(previous);
    }
  };

  const handleRedo = () => {
    if (historyIndex >= historyRef.current.length - 1) return;
    const nextIndex = historyIndex + 1;
    const previous = deserializeGraph(historyRef.current[nextIndex]);
    setHistoryIndex(nextIndex);
    if (previous) {
      setGraph(previous);
    }
  };

  const saveProject = () => {
    const nextProjects = savedProjects.filter((project) => project.id !== graph.id);
    nextProjects.push({
      id: graph.id,
      name: graph.name,
      updatedAt: new Date().toISOString(),
      graph: serializeGraph(graph),
    });
    const trimmedProjects = nextProjects.slice(-8);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedProjects));
    setSavedProjects(trimmedProjects);
  };

  const loadProject = (projectGraph: string) => {
    const parsed = deserializeGraph(projectGraph);
    if (!parsed) return;
    setGraph(parsed);
    setSelectedNodeId(parsed.nodes[0]?.id ?? null);
    const serialized = serializeGraph(parsed);
    historyRef.current = [...historyRef.current.slice(0, historyIndex + 1), serialized].slice(-20);
    setHistoryIndex(historyRef.current.length - 1);
  };

  const nodeTypes = listNodeTypes();

  return (
    <div className="studioPage">
      <aside className="studioSidebar">
        <div className="studioBrandRow">
          <span className="studioBrand">Scamtastic Studio</span>
          <span className="studioVersion">graph v{graph.schemaVersion}</span>
        </div>

        <div className="studioToolbar">
          <button type="button" className="button primary" onClick={() => addNode('core.color')}>
            Add color
          </button>
          <button type="button" className="button secondary" onClick={() => addNode('core.surface')}>
            Add background
          </button>
          <button type="button" className="button secondary" onClick={() => addNode('core.glow')}>
            Add glow
          </button>
        </div>

        <div className="studioLibrary">
          <h3>Node library</h3>
          <ul>
            {nodeTypes.map((nodeType) => (
              <li key={nodeType.id}>
                <button type="button" onClick={() => addNode(nodeType.id)}>{nodeType.label}</button>
              </li>
            ))}
          </ul>
        </div>

        <div className="studioSavedProjects">
          <h3>Saved drafts</h3>
          {savedProjects.length === 0 ? (
            <p className="muted">No browser drafts saved yet.</p>
          ) : (
            <ul>
              {savedProjects.map((project) => (
                <li key={project.id}>
                  <button type="button" onClick={() => loadProject(project.graph)}>
                    {project.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <main className="studioWorkspace">
        <header className="studioHeader">
          <input
            className="studioNameInput"
            value={graph.name}
            onChange={(event) => {
              const nextGraph = { ...graph, name: event.target.value };
              setGraph(nextGraph);
            }}
            aria-label="Project name"
          />
          <div className="studioHeaderActions">
            <button type="button" className="button secondary" onClick={handleUndo} disabled={historyIndex === 0}>
              Undo
            </button>
            <button type="button" className="button secondary" onClick={handleRedo} disabled={historyIndex >= historyRef.current.length - 1}>
              Redo
            </button>
            <button type="button" className="button primary" onClick={saveProject}>
              Save
            </button>
          </div>
        </header>

        <div className="studioCanvasShell">
          <div className="studioCanvas" aria-label="Project graph canvas">
            {graph.nodes.map((node) => {
              const type = getNodeType(node.type);
              const isSelected = selectedNodeId === node.id;
              return (
                <div
                  key={node.id}
                  className={`studioNode ${isSelected ? 'selected' : ''}`}
                  style={{ left: `${node.x}px`, top: `${node.y}px` }}
                  onClick={() => setSelectedNodeId(node.id)}
                >
                  <div
                    className="studioNodeHeader"
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      setDragging({
                        nodeId: node.id,
                        pointerX: event.clientX,
                        pointerY: event.clientY,
                        startX: node.x,
                        startY: node.y,
                      });
                    }}
                  >
                    <span>{type?.label ?? node.type}</span>
                    <button
                      type="button"
                      aria-label={`Delete ${node.id}`}
                      className="studioDeleteButton"
                      onClick={(event) => {
                        event.stopPropagation();
                        removeNode(node.id);
                      }}
                    >
                      ×
                    </button>
                  </div>

                  <div className="studioPortsRow">
                    <div className="studioPortsColumn">
                      {type?.inputPorts.map((port: { id: string }) => (
                        <button
                          key={port.id}
                          type="button"
                          className={`studioPort studioPortInput ${pendingConnection ? 'active' : ''}`}
                          onClick={() => {
                            if (pendingConnection) {
                              finishConnection(node.id, port.id);
                            }
                          }}
                        >
                          <span className="studioPortLabel">{port.id}</span>
                        </button>
                      ))}
                    </div>
                    <div className="studioPortsColumn">
                      {type?.outputPorts.map((port: { id: string }) => (
                        <button
                          key={port.id}
                          type="button"
                          className={`studioPort studioPortOutput ${pendingConnection ? 'active' : ''}`}
                          onClick={() => {
                            if (pendingConnection) {
                              finishConnection(node.id, port.id);
                            } else {
                              startConnection(node.id, port.id);
                            }
                          }}
                        >
                          <span className="studioPortLabel">{port.id}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}

            <svg className="studioConnections" viewBox={`0 0 ${Math.max(1200, graph.nodes.reduce((max, node) => Math.max(max, node.x + 200), 0))} ${Math.max(800, graph.nodes.reduce((max, node) => Math.max(max, node.y + 160), 0))}`} preserveAspectRatio="xMidYMid meet">
              {graph.connections.map((connection) => {
                const sourceNode = graph.nodes.find((node) => node.id === connection.sourceNodeId);
                const targetNode = graph.nodes.find((node) => node.id === connection.targetNodeId);
                if (!sourceNode || !targetNode) return null;
                const x1 = sourceNode.x + 150;
                const y1 = sourceNode.y + 50;
                const x2 = targetNode.x + 10;
                const y2 = targetNode.y + 50;
                return (
                  <g key={connection.id}>
                    <path d={`M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`} className="studioConnectionPath" />
                    <g onClick={() => removeConnection(connection.id)} className="studioConnectionDeleteAction">
                      <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="8" />
                    </g>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="studioPreviewPanel">
            <div className="studioPreviewHeader">
              <h3>Preview</h3>
              <span>{graph.nodes.length} nodes / {graph.connections.length} connections</span>
            </div>
            <div className="studioPreviewScene" style={{ background: preview.background, boxShadow: preview.glow }}>
              <div className="studioPreviewInner" style={{ background: preview.background, borderColor: preview.accent }}>
                <span>result</span>
              </div>
            </div>
            {validation.valid ? (
              <p className="studioStatus success">Graph checks passed.</p>
            ) : (
              <div className="studioStatus error">
                {validation.errors.map((error) => <div key={error}>{error}</div>)}
              </div>
            )}
          </div>
        </div>
      </main>

      <aside className="studioInspector">
        {selectedNode ? (
          <>
            <h3>Inspector</h3>
            <p className="studioInspectorMeta">{selectedNode.type}</p>
            {Object.entries(selectedNode.params).map(([key, value]) => {
              const type = getNodeType(selectedNode.type);
              const schema = type?.parameterSchema?.[key];
              const inputType = schema?.type ?? 'string';
              return (
                <label key={key} className="studioField">
                  <span>{key}</span>
                  {inputType === 'number' ? (
                    <input
                      type="number"
                      step="any"
                      value={typeof value === 'number' ? value : Number(value ?? 0)}
                      onChange={(event) => updateNodeParam(selectedNode.id, key, event.target.value)}
                    />
                  ) : (
                    <input
                      type="text"
                      value={String(value ?? '')}
                      onChange={(event) => updateNodeParam(selectedNode.id, key, event.target.value)}
                    />
                  )}
                </label>
              );
            })}
          </>
        ) : (
          <div className="studioEmptyInspector">
            <h3>Inspector</h3>
            <p>Select a node to edit its parameters.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
