'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { GraphEdge, GraphNode, ProjectGraph } from '../../lib/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { EmptyState, ErrorAlert, LoadingSpinner } from '../ui';

// Type-based color and icon styling
const ENTITY_STYLES: Record<string, { bg: string; border: string; text: string; icon: string }> = {
  requirement: { bg: 'rgba(56, 189, 248, 0.15)', border: '#38bdf8', text: '#38bdf8', icon: '📋' },
  component: { bg: 'rgba(99, 102, 241, 0.15)', border: '#6366f1', text: '#818cf8', icon: '🧩' },
  decision: { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#c084fc', icon: '📜' },
  task: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399', icon: '✅' },
  test: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24', icon: '🧪' },
  risk: { bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', text: '#fb7185', icon: '⚠️' },
  artifact: { bg: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8', text: '#cbd5e1', icon: '📄' },
};

export function GraphCanvas({ projectId }: { projectId: string }) {
  const [graph, setGraph] = useState<ProjectGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const fetchGraph = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.getProjectGraph(projectId);
      setGraph(data);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'GRAPH_ERROR', err?.message || 'Failed to load knowledge graph'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGraph();
  }, [projectId]);

  // Compute layout positions for nodes deterministically
  const layout = useMemo(() => {
    if (!graph || graph.nodes.length === 0) return { positions: new Map<string, { x: number; y: number }>(), width: 800, height: 500 };

    const positions = new Map<string, { x: number; y: number }>();
    const nodeCount = graph.nodes.length;

    // Arrange nodes in layered columns or circular grid
    const cols = Math.ceil(Math.sqrt(nodeCount));
    const spacingX = 240;
    const spacingY = 160;

    graph.nodes.forEach((node, index) => {
      const row = Math.floor(index / cols);
      const col = index % cols;
      const x = 100 + col * spacingX + (row % 2 === 1 ? 40 : 0);
      const y = 80 + row * spacingY;
      positions.set(node.id, { x, y });
    });

    const width = Math.max(800, (cols + 1) * spacingX);
    const height = Math.max(500, (Math.ceil(nodeCount / cols) + 1) * spacingY);

    return { positions, width, height };
  }, [graph]);

  const selectedNode = useMemo(() => {
    if (!graph || !selectedNodeId) return null;
    return graph.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [graph, selectedNodeId]);

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Assembling Knowledge Graph from TraceLinks..." />;
  }

  if (error) {
    return (
      <ErrorAlert
        title="Knowledge Graph Error"
        message={error.message}
        errorCode={error.errorCode}
        requestId={error.requestId}
        onRetry={fetchGraph}
      />
    );
  }

  if (!graph || graph.nodes.length === 0) {
    return (
      <EmptyState
        icon="🕸️"
        title="No Knowledge Graph Available"
        description="The knowledge graph is assembled from accepted TraceLinks. Once requirements, components, tasks, and tests are approved, their relationships will appear here."
      />
    );
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 160px)', position: 'relative' }}>
      {/* Main Canvas Container */}
      <div
        style={{
          flex: 1,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Controls Toolbar */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '6px 12px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
          }}
        >
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
            onClick={() => setZoom((z) => Math.min(z + 0.15, 2))}
          >
            🔍+
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
          >
            🔍-
          </button>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', fontSize: '0.8125rem' }}
            onClick={() => setZoom(1)}
          >
            Reset
          </button>
        </div>

        {/* Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: 16,
            zIndex: 10,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            padding: '8px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)',
            fontSize: '0.75rem',
          }}
        >
          {Object.entries(ENTITY_STYLES).map(([type, style]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>{style.icon}</span>
              <span style={{ color: style.text, textTransform: 'capitalize' }}>{type}</span>
            </div>
          ))}
        </div>

        {/* Interactive SVG Diagram */}
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <svg
            width={layout.width * zoom}
            height={layout.height * zoom}
            viewBox={`0 0 ${layout.width} ${layout.height}`}
            style={{ minWidth: '100%', minHeight: '100%' }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="22"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#38bdf8" />
              </marker>
            </defs>

            {/* Render Directed Edges */}
            {graph.edges.map((edge) => {
              const src = layout.positions.get(edge.source);
              const tgt = layout.positions.get(edge.target);
              if (!src || !tgt) return null;

              const isConnectedToSelected =
                selectedNodeId === edge.source || selectedNodeId === edge.target;

              const midX = (src.x + tgt.x) / 2;
              const midY = (src.y + tgt.y) / 2;

              return (
                <g key={edge.id}>
                  <line
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={isConnectedToSelected ? '#38bdf8' : 'rgba(255, 255, 255, 0.2)'}
                    strokeWidth={isConnectedToSelected ? 2.5 : 1.5}
                    markerEnd="url(#arrowhead)"
                  />
                  <rect
                    x={midX - 35}
                    y={midY - 10}
                    width="70"
                    height="18"
                    rx="4"
                    fill="var(--bg-primary)"
                    stroke="var(--border-color)"
                  />
                  <text
                    x={midX}
                    y={midY + 3}
                    textAnchor="middle"
                    fill={isConnectedToSelected ? '#38bdf8' : 'var(--text-muted)'}
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {edge.relation}
                  </text>
                </g>
              );
            })}

            {/* Render Nodes */}
            {graph.nodes.map((node) => {
              const pos = layout.positions.get(node.id);
              if (!pos) return null;

              const style = ENTITY_STYLES[node.type] || ENTITY_STYLES.requirement;
              const isSelected = selectedNodeId === node.id;

              return (
                <g
                  key={node.id}
                  transform={`translate(${pos.x - 70}, ${pos.y - 25})`}
                  onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <rect
                    width="140"
                    height="50"
                    rx="8"
                    fill={isSelected ? style.bg : 'var(--bg-card)'}
                    stroke={isSelected ? style.border : 'rgba(255, 255, 255, 0.15)'}
                    strokeWidth={isSelected ? 2 : 1}
                    style={{
                      filter: isSelected ? 'drop-shadow(0 0 10px rgba(56, 189, 248, 0.4))' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  />
                  <text x="12" y="20" fontSize="12" fill={style.text}>
                    {style.icon} {node.type.toUpperCase()}
                  </text>
                  <text
                    x="12"
                    y="38"
                    fontSize="11"
                    fontWeight="600"
                    fill="var(--text-primary)"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                  >
                    {node.label.length > 28 ? `${node.label.slice(0, 28)}...` : node.label}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Node Inspector Panel */}
      {selectedNode && (
        <div
          className="card"
          style={{
            width: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="badge badge-purple">{selectedNode.type}</span>
            <button
              onClick={() => setSelectedNodeId(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
            >
              ✕
            </button>
          </div>

          <div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              {selectedNode.label}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              ID: {selectedNode.id}
            </span>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
              Connected Trace Links:
            </div>
            {graph.edges
              .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
              .map((e) => (
                <div
                  key={e.id}
                  style={{
                    fontSize: '0.75rem',
                    padding: '6px 8px',
                    background: 'var(--bg-input)',
                    borderRadius: 4,
                    marginBottom: 6,
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ color: '#38bdf8', fontWeight: 600 }}>{e.relation}</span>{' '}
                  {e.source === selectedNode.id ? `➔ ${e.target}` : `⬅ from ${e.source}`}
                </div>
              ))}
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Metadata:
            </div>
            <pre
              style={{
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                background: 'var(--bg-input)',
                padding: 8,
                borderRadius: 4,
                overflowX: 'auto',
              }}
            >
              {JSON.stringify(selectedNode.data, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
