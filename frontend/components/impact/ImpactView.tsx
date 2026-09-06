'use client';

import React, { useState } from 'react';
import { ImpactRequest, ImpactResponse, SourceTargetType } from '../../lib/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { EmptyState, ErrorAlert, LoadingSpinner } from '../ui';

const ENTITY_TYPES: SourceTargetType[] = [
  'requirement',
  'component',
  'decision',
  'task',
  'test',
  'risk',
  'artifact',
];

export function ImpactView({ projectId }: { projectId: string }) {
  const [entityType, setEntityType] = useState<SourceTargetType>('requirement');
  const [entityId, setEntityId] = useState('');
  const [result, setResult] = useState<ImpactResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = entityId.trim();
    if (!id || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.analyzeImpact(projectId, {
        entityType,
        entityId: id,
      });
      setResult(data);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'IMPACT_ERROR', err?.message || 'Failed to analyze impact'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Control Form */}
      <div className="card">
        <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          ⚡ Change Impact Analysis (Deterministic Traversal + AI Explanation)
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
          Evaluate all downstream dependencies and engineering artifacts structurally affected by a proposed change.
        </p>

        <form onSubmit={handleAnalyze} style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ minWidth: 200 }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Target Entity Type:
            </label>
            <select
              className="input-field"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value as SourceTargetType)}
            >
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: 280 }}>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Entity Identifier (e.g. req-101, comp-auth):
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter exact entity ID..."
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!entityId.trim() || isLoading}
            style={{ height: 42, minWidth: 160 }}
          >
            {isLoading ? 'Analyzing...' : 'Run Impact Analysis ➔'}
          </button>
        </form>
      </div>

      {error && (
        <ErrorAlert
          title="Impact Analysis Error"
          message={error.message}
          errorCode={error.errorCode}
          requestId={error.requestId}
          onDismiss={() => setError(null)}
        />
      )}

      {isLoading && <LoadingSpinner size="lg" label="Running cycle-safe BFS graph traversal over TraceLinks..." />}

      {/* Analysis Results View */}
      {result && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Summary Card */}
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.7) 100%)',
              borderLeft: '4px solid #38bdf8',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <span className="badge badge-blue">Evaluated Target</span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
                  {result.changedEntityType.toUpperCase()} : {result.changedEntityId}
                </h3>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: result.affectedEntities.length > 0 ? '#fbbf24' : '#34d399' }}>
                  {result.affectedEntities.length} Downstream {result.affectedEntities.length === 1 ? 'Entity' : 'Entities'}
                </div>
                {result.runId && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    Run ID: {result.runId}
                  </span>
                )}
              </div>
            </div>

            {/* Semantic AI Explanation */}
            {result.explanation ? (
              <div style={{ marginTop: 16, padding: 14, background: 'rgba(56, 189, 248, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(56, 189, 248, 0.2)' }}>
                <div style={{ fontWeight: 600, color: '#38bdf8', fontSize: '0.875rem', marginBottom: 4 }}>
                  🧠 AI Semantic Impact Rationale:
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', lineHeight: 1.6, margin: 0 }}>
                  {result.explanation}
                </p>
              </div>
            ) : (
              <div style={{ marginTop: 12, fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                ℹ️ Structural traversal complete. (Semantic AI explanation ready to be enriched by Account 3).
              </div>
            )}
          </div>

          {/* Affected Entities List */}
          {result.affectedEntities.length === 0 ? (
            <EmptyState
              icon="🛡️"
              title="No Downstream Impact Detected"
              description={`Changing ${result.changedEntityType} '${result.changedEntityId}' has no reachable downstream dependencies in the current project knowledge graph.`}
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                Affected Downstream Entities ({result.affectedEntities.length})
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
                {result.affectedEntities.map((affected, idx) => (
                  <div key={idx} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-purple">{affected.entityType}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {affected.entityId}
                      </span>
                    </div>

                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>
                      {affected.label || `${affected.entityType} ${affected.entityId}`}
                    </div>

                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        Trace Path:
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                        {affected.relationPath.map((rel, rIdx) => (
                          <React.Fragment key={rIdx}>
                            <span
                              style={{
                                fontSize: '0.6875rem',
                                padding: '2px 6px',
                                background: 'var(--bg-tertiary)',
                                color: '#38bdf8',
                                borderRadius: 4,
                                fontFamily: 'monospace',
                              }}
                            >
                              {rel}
                            </span>
                            {rIdx < affected.relationPath.length - 1 && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>➔</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
