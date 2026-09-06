'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Proposal } from '../../../../lib/contracts';
import { apiClient } from '../../../../lib/api-client';
import { EmptyState, LoadingSpinner } from '../../../../components/ui';

export default function RisksPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [riskProposals, setRiskProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    apiClient
      .listProposals(projectId)
      .then((res) => {
        const risks = (res.proposals || []).filter((p) => p.entityType === 'risk');
        setRiskProposals(risks);
      })
      .catch((err) => console.error(err))
      .finally(() => setIsLoading(false));
  }, [projectId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Risk Analysis & Failure Modes
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Technical, security, and operational risks with server-computed severity scores.
          </p>
        </div>

        <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
          💬 Assess Risks in Chat
        </Link>
      </div>

      {isLoading ? (
        <LoadingSpinner size="lg" label="Loading risk register..." />
      ) : riskProposals.length === 0 ? (
        <EmptyState
          icon="⚠️"
          title="No Risks Registered"
          description="Ask the Risk Specialist in Chat to evaluate potential vulnerabilities, performance bottlenecks, and failure modes."
          action={
            <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
              💬 Assess Project Risks
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {riskProposals.map((prop) => {
            const risk = prop.entityPayload || {};
            const score = risk.score || 0;
            const scoreColor = score >= 9 ? '#fb7185' : score >= 6 ? '#fbbf24' : '#34d399';

            return (
              <div key={prop.proposalId} className="card card-hover" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${prop.status === 'approved' ? 'badge-approved' : 'badge-pending'}`}>
                      {prop.status}
                    </span>
                    <span className="badge badge-purple">{risk.category || 'TECHNICAL'}</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: 'rgba(0,0,0,0.3)',
                        color: scoreColor,
                        border: `1px solid ${scoreColor}`,
                      }}
                    >
                      Severity Score: {score}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Likelihood: <strong style={{ color: 'var(--text-primary)' }}>{risk.likelihood}</strong> • Impact: <strong style={{ color: 'var(--text-primary)' }}>{risk.impact}</strong>
                  </div>
                </div>

                <div style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                  {risk.description}
                </div>

                {risk.mitigationRefs && risk.mitigationRefs.length > 0 && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Mitigating Tasks: <code style={{ color: '#38bdf8' }}>{risk.mitigationRefs.join(', ')}</code>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
