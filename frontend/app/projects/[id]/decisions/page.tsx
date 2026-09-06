'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Decision } from '../../../../lib/contracts';
import { apiClient, ApiError } from '../../../../lib/api-client';
import { EmptyState, ErrorAlert, LoadingSpinner } from '../../../../components/ui';

export default function DecisionsPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchDecisions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.listDecisions(projectId);
      setDecisions(res.decisions || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'LIST_DECISIONS_ERROR', err?.message || 'Failed to load decisions'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchDecisions();
    }
  }, [projectId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Architectural Decision Records (ADR)
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Authoritative architectural decisions, context, and downstream engineering consequences.
          </p>
        </div>

        <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
          💬 Draft ADR via AI Chat
        </Link>
      </div>

      {error && (
        <ErrorAlert
          title="Decisions Error"
          message={error.message}
          errorCode={error.errorCode}
          requestId={error.requestId}
          onRetry={fetchDecisions}
        />
      )}

      {isLoading ? (
        <LoadingSpinner size="lg" label="Loading architectural decisions..." />
      ) : decisions.length === 0 ? (
        <EmptyState
          icon="📜"
          title="No Architectural Decisions Recorded"
          description="Decisions approved through the proposal workflow are persisted as permanent ADR records."
          action={
            <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
              💬 Discuss Architecture in Chat
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {decisions.map((dec) => (
            <div key={dec.decisionId} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-purple">{dec.status}</span>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {dec.title}
                  </h3>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                  ID: {dec.decisionId} • v{dec.version}
                </span>
              </div>

              {dec.context && (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Context: </strong>
                  {dec.context}
                </div>
              )}

              <div style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', background: 'var(--bg-input)', padding: 12, borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
                <strong style={{ color: '#38bdf8' }}>Decision: </strong>
                {dec.decision}
              </div>

              {dec.consequences && dec.consequences.length > 0 && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Consequences:</strong>
                  <ul style={{ paddingLeft: 20, marginTop: 4 }}>
                    {dec.consequences.map((c, idx) => (
                      <li key={idx} style={{ marginBottom: 2 }}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
