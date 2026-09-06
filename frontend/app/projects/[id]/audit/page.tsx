'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { AuditEvent } from '../../../../lib/contracts';
import { apiClient, ApiError } from '../../../../lib/api-client';
import { EmptyState, ErrorAlert, LoadingSpinner } from '../../../../components/ui';

export default function AuditTrailPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const fetchAuditEvents = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.listAuditEvents(projectId, 50);
      setAuditEvents(res.events || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'LIST_AUDIT_ERROR', err?.message || 'Failed to load audit events'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchAuditEvents();
    }
  }, [projectId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Immutable Audit Trail
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
          Tamper-evident audit log of every approved proposal, rejection, and consequential project action.
        </p>
      </div>

      {error && (
        <ErrorAlert
          title="Audit Trail Error"
          message={error.message}
          errorCode={error.errorCode}
          requestId={error.requestId}
          onRetry={fetchAuditEvents}
        />
      )}

      {isLoading ? (
        <LoadingSpinner size="lg" label="Loading audit trail records..." />
      ) : auditEvents.length === 0 ? (
        <EmptyState
          icon="🛡️"
          title="No Audit Events Yet"
          description="Consequential actions such as proposal approvals and rejections will record immutable audit events here."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {auditEvents.map((event) => (
            <div
              key={event.eventId}
              className="card"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                padding: '14px 20px',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{ fontSize: '1.25rem' }}>
                  {event.action.includes('approved') ? '✅' : event.action.includes('rejected') ? '🚫' : '📝'}
                </span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                    {event.action.replace('_', ' ').toUpperCase()}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Target: <span style={{ color: 'var(--text-secondary)' }}>{event.targetType}</span> (<code>{event.targetId}</code>)
                  </div>
                </div>
              </div>

              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                <div>Actor: <strong style={{ color: 'var(--text-primary)' }}>{event.actor}</strong> {event.actorUid ? `(${event.actorUid})` : ''}</div>
                <div style={{ marginTop: 2 }}>{new Date(event.timestamp).toLocaleString()}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
