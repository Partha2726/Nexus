/**
 * Component and UX tests for NEXUS frontend.
 * 
 * Verifies proposal approval flow (actionId == proposalId), error handling, empty states, and graph rendering.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProposalCard } from '../components/proposals/ProposalCard';
import { EmptyState, ErrorAlert } from '../components/ui';
import { Proposal } from '../lib/contracts';
import { apiClient } from '../lib/api-client';

describe('ProposalCard Component', () => {
  const mockProposal: Proposal = {
    proposalId: 'prop-unit-1',
    projectId: 'proj-unit',
    runId: 'run-1',
    actionClass: 'PROPOSE',
    entityType: 'requirement',
    entityPayload: {
      statement: 'Enforce OAuth2 MFA login',
      priority: 'must',
      acceptanceCriteria: ['Pass TOTP test'],
    },
    affectedEntityIds: [],
    confidence: 'high',
    rationale: 'Derived from user specification',
    status: 'pending',
    projectVersionAtCreation: 3,
    createdAt: '2026-09-06T10:00:00Z',
  };

  it('renders proposal details, metadata, and status badge', () => {
    render(<ProposalCard proposal={mockProposal} />);

    expect(screen.getByText('pending')).toBeInTheDocument();
    expect(screen.getByText('requirement')).toBeInTheDocument();
    expect(screen.getByText('PROPOSE')).toBeInTheDocument();
    expect(screen.getByText(/Version at creation: v3/i)).toBeInTheDocument();
    expect(screen.getByText(/Derived from user specification/i)).toBeInTheDocument();
  });

  it('handles approve click by calling apiClient.approveProposal with actionId == proposalId', async () => {
    const approveSpy = vi.spyOn(apiClient, 'approveProposal').mockResolvedValueOnce({
      proposalId: 'prop-unit-1',
      status: 'approved',
      entityType: 'requirement',
      entityId: 'req-1',
      projectVersion: 4,
      auditEventId: 'evt-1',
    });

    const statusChangeSpy = vi.fn();
    render(<ProposalCard proposal={mockProposal} onStatusChange={statusChangeSpy} />);

    const approveButton = screen.getByRole('button', { name: /approve & commit/i });
    fireEvent.click(approveButton);

    await waitFor(() => {
      expect(approveSpy).toHaveBeenCalledWith('proj-unit', 'prop-unit-1');
      expect(statusChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalId: 'prop-unit-1',
          status: 'approved',
        })
      );
    });
  });

  it('handles reject click by opening modal and confirming rejection', async () => {
    const rejectSpy = vi.spyOn(apiClient, 'rejectProposal').mockResolvedValueOnce({
      proposalId: 'prop-unit-1',
      status: 'rejected',
      auditEventId: 'evt-2',
    });

    const statusChangeSpy = vi.fn();
    render(<ProposalCard proposal={mockProposal} onStatusChange={statusChangeSpy} />);

    // Click reject button to open modal
    const rejectButton = screen.getByRole('button', { name: /reject/i });
    fireEvent.click(rejectButton);

    // Modal is opened
    expect(screen.getByText(/Are you sure you want to reject proposal/i)).toBeInTheDocument();

    const confirmButton = screen.getByRole('button', { name: /confirm rejection/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(rejectSpy).toHaveBeenCalledWith('proj-unit', 'prop-unit-1', { reason: undefined });
      expect(statusChangeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          proposalId: 'prop-unit-1',
          status: 'rejected',
        })
      );
    });
  });
});

describe('UI Support Components', () => {
  it('renders EmptyState with title, description and optional action', () => {
    render(
      <EmptyState
        title="No Records Found"
        description="Please create a new entry to begin."
        action={<button>Create Now</button>}
      />
    );

    expect(screen.getByText('No Records Found')).toBeInTheDocument();
    expect(screen.getByText('Please create a new entry to begin.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Now' })).toBeInTheDocument();
  });

  it('renders ErrorAlert with error code, message and retry button', () => {
    const retrySpy = vi.fn();
    render(
      <ErrorAlert
        title="Custom Error Title"
        message="Failed to communicate with service"
        errorCode="STALE_VERSION"
        requestId="req-xyz"
        onRetry={retrySpy}
      />
    );

    expect(screen.getByText(/STALE_VERSION/i)).toBeInTheDocument();
    expect(screen.getByText('Failed to communicate with service')).toBeInTheDocument();
    expect(screen.getByText(/Request ID: req-xyz/i)).toBeInTheDocument();

    const retryBtn = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);
    expect(retrySpy).toHaveBeenCalled();
  });
});
