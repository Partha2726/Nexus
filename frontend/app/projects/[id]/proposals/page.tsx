'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Proposal } from '../../../../lib/contracts';
import { apiClient, ApiError } from '../../../../lib/api-client';
import { EmptyState, ErrorAlert, LoadingSpinner } from '../../../../components/ui';
import { ProposalCard } from '../../../../components/proposals/ProposalCard';

export default function ProposalsDashboardPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending');

  const fetchProposals = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.listProposals(projectId, statusFilter || undefined);
      setProposals(res.proposals || []);
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'LIST_PROPOSALS_ERROR', err?.message || 'Failed to load proposals'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (projectId) {
      fetchProposals();
    }
  }, [projectId, statusFilter]);

  const pendingCount = proposals.filter((p) => p.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Proposal Verification & Authorization
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Human-in-the-loop gate for AI-generated candidates. Approvals commit atomically via transactional concurrency.
          </p>
        </div>

        <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
          💬 Draft in AI Chat
        </Link>
      </div>

      {/* Tabs Filter */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', paddingBottom: 12 }}>
        {[
          { label: 'Pending Review', value: 'pending', count: statusFilter === 'pending' ? pendingCount : undefined },
          { label: 'Approved', value: 'approved' },
          { label: 'Rejected', value: 'rejected' },
          { label: 'All Proposals', value: '' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className="btn"
            style={{
              padding: '6px 14px',
              fontSize: '0.8125rem',
              background: statusFilter === tab.value ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: statusFilter === tab.value ? '#38bdf8' : 'var(--text-secondary)',
              borderColor: statusFilter === tab.value ? 'rgba(56, 189, 248, 0.3)' : 'transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <ErrorAlert
          title="Proposals Error"
          message={error.message}
          errorCode={error.errorCode}
          requestId={error.requestId}
          onRetry={fetchProposals}
        />
      )}

      {isLoading ? (
        <LoadingSpinner size="lg" label="Loading proposals..." />
      ) : proposals.length === 0 ? (
        <EmptyState
          icon="⚖️"
          title={`No ${statusFilter ? statusFilter : ''} proposals`}
          description={
            statusFilter === 'pending'
              ? 'No proposals are currently awaiting human review. Ask an AI specialist in Chat to propose requirements, architecture, or tasks.'
              : 'No proposals matching this filter were found.'
          }
          action={
            <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
              💬 Go to AI Chat
            </Link>
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {proposals.map((prop) => (
            <ProposalCard
              key={prop.proposalId}
              proposal={prop}
              onStatusChange={(updated) => {
                setProposals((prev) =>
                  prev.map((p) => (p.proposalId === updated.proposalId ? updated : p))
                );
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
