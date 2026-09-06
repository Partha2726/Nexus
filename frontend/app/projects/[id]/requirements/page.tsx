'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Requirement } from '../../../../lib/contracts';
import { apiClient, ApiError } from '../../../../lib/api-client';
import { EmptyState, ErrorAlert, LoadingSpinner } from '../../../../components/ui';

export default function RequirementsPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [priorityFilter, setPriorityFilter] = useState<string>('');

  const fetchRequirements = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.listRequirements(projectId, {
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setRequirements(res.requirements || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'LIST_REQUIREMENTS_ERROR', err?.message || 'Failed to load requirements'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchRequirements();
    }
  }, [projectId, statusFilter, priorityFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
      {/* Header & Actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Authoritative Requirements
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Accepted functional and non-functional specifications governing the project.
          </p>
        </div>

        <div>
          <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
            🤖 Draft in AI Chat ➔
          </Link>
        </div>
      </div>

      {/* Contract Explanation Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
          padding: '14px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '1.5rem' }}>📋</span>
          <div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Contract-Governed Authoritative Requirements
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              In NEXUS, requirements are drafted with AI Specialist agents, generated as verifiable candidate proposals,
              and committed atomically upon human verification.
            </div>
          </div>
        </div>
        <Link href={`/projects/${projectId}/chat`} className="btn btn-secondary" style={{ fontSize: '0.8125rem' }}>
          Open AI Chat
        </Link>
      </div>

      {/* Filter Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: 14,
          alignItems: 'center',
          background: 'var(--bg-secondary)',
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
        }}
      >
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filters:</span>
        <select
          className="input-field"
          style={{ width: 160, padding: '6px 10px', fontSize: '0.8125rem' }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="accepted">Accepted</option>
          <option value="proposed">Proposed</option>
          <option value="rejected">Rejected</option>
          <option value="superseded">Superseded</option>
        </select>

        <select
          className="input-field"
          style={{ width: 160, padding: '6px 10px', fontSize: '0.8125rem' }}
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="must">Must Have</option>
          <option value="should">Should Have</option>
          <option value="may">May Have</option>
        </select>

        {(statusFilter || priorityFilter) && (
          <button
            className="btn btn-secondary"
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
            onClick={() => {
              setStatusFilter('');
              setPriorityFilter('');
            }}
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Content State */}
      {isLoading ? (
        <LoadingSpinner size="lg" label="Loading authoritative requirements..." />
      ) : error ? (
        <ErrorAlert
          title="Failed to Load Requirements"
          message={error.message}
          errorCode={error.errorCode}
          requestId={error.requestId}
          onRetry={fetchRequirements}
        />
      ) : requirements.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No Authoritative Requirements Found"
          description={
            statusFilter || priorityFilter
              ? 'No requirements match the active filters.'
              : 'No requirements have been approved yet. Use AI Specialist Chat to formulate specifications and approve the candidate proposals.'
          }
          action={
            <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
              Draft Requirements in AI Chat ➔
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {requirements.map((req) => (
            <div key={req.requirementId} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-blue">{req.type.toUpperCase()}</span>
                  <span
                    className={`badge ${
                      req.priority === 'must'
                        ? 'badge-red'
                        : req.priority === 'should'
                        ? 'badge-yellow'
                        : 'badge-gray'
                    }`}
                  >
                    {req.priority.toUpperCase()}
                  </span>
                  <span
                    className={`badge ${
                      req.status === 'accepted'
                        ? 'badge-green'
                        : req.status === 'proposed'
                        ? 'badge-yellow'
                        : 'badge-gray'
                    }`}
                  >
                    {req.status}
                  </span>
                </div>
                <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                  ID: {req.requirementId}
                </span>
              </div>

              <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                {req.statement}
              </div>

              {req.rationale && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Rationale: </strong>
                  {req.rationale}
                </div>
              )}

              {req.acceptanceCriteria && req.acceptanceCriteria.length > 0 && (
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
                    Acceptance Criteria:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {req.acceptanceCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
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
