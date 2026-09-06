'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Proposal, Requirement, ProjectGraph } from '../../../lib/contracts';
import { apiClient } from '../../../lib/api-client';
import { EmptyState, LoadingSpinner } from '../../../components/ui';
import { ProposalCard } from '../../../components/proposals/ProposalCard';

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params?.id as string;

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [graph, setGraph] = useState<ProjectGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    Promise.allSettled([
      apiClient.listProposals(projectId),
      apiClient.listRequirements(projectId),
      apiClient.getProjectGraph(projectId),
    ]).then(([propRes, reqRes, graphRes]) => {
      if (propRes.status === 'fulfilled') {
        setProposals(propRes.value.proposals || []);
      }
      if (reqRes.status === 'fulfilled') {
        setRequirements(reqRes.value.requirements || []);
      }
      if (graphRes.status === 'fulfilled') {
        setGraph(graphRes.value);
      }
      setIsLoading(false);
    });
  }, [projectId]);

  const pendingProposals = proposals.filter((p) => p.status === 'pending');

  if (isLoading) {
    return <LoadingSpinner size="lg" label="Loading project overview..." />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 1200, margin: '0 auto' }}>
      {/* Welcome Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.8) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <span className="badge badge-blue">Engineering Intelligence Workspace</span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 6 }}>
            Deterministic Architecture & Traceability
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4, maxWidth: 640 }}>
            Collaborate with AI specialist agents to generate verifiable specifications. All mutations require
            explicit human verification and commit atomically via transactional concurrency control.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
            💬 Open AI Chat
          </Link>
          <Link href={`/projects/${projectId}/architecture`} className="btn btn-secondary">
            🕸️ View Graph
          </Link>
        </div>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Pending Proposals
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: pendingProposals.length > 0 ? '#fbbf24' : '#94a3b8', marginTop: 4 }}>
            {pendingProposals.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Awaiting human approval
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Authoritative Requirements
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#38bdf8', marginTop: 4 }}>
            {requirements.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Accepted specifications
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Knowledge Graph Nodes
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#818cf8', marginTop: 4 }}>
            {graph?.nodes?.length || 0}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            {graph?.edges?.length || 0} TraceLinks connected
          </div>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Total Proposals
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#34d399', marginTop: 4 }}>
            {proposals.length}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Generated by AI agents
          </div>
        </div>
      </div>

      {/* Pending Proposals Section */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div>
            <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Proposals Requiring Verification
            </h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Candidate actions generated by specialist agents awaiting transactional approval.
            </p>
          </div>
          <Link href={`/projects/${projectId}/proposals`} style={{ fontSize: '0.8125rem', color: '#38bdf8', textDecoration: 'none' }}>
            View All Proposals ➔
          </Link>
        </div>

        {pendingProposals.length === 0 ? (
          <EmptyState
            icon="✨"
            title="All Proposals Reviewed"
            description="There are currently no pending proposals awaiting review. Use AI Chat to draft new requirements, architecture, tasks, or tests."
            action={
              <Link href={`/projects/${projectId}/chat`} className="btn btn-primary">
                Draft New Requirements in Chat ➔
              </Link>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {pendingProposals.slice(0, 3).map((prop) => (
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
    </div>
  );
}
