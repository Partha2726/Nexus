'use client';

import React, { useState } from 'react';
import { Proposal } from '../../lib/contracts';
import { apiClient, ApiError } from '../../lib/api-client';
import { ErrorAlert, LoadingSpinner, Modal } from '../ui';

export function ProposalCard({
  proposal,
  onStatusChange,
}: {
  proposal: Proposal;
  onStatusChange?: (updated: Proposal) => void;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const isPending = proposal.status === 'pending';

  const handleApprove = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      // actionId == proposalId
      const res = await apiClient.approveProposal(proposal.projectId, proposal.proposalId);
      if (onStatusChange) {
        onStatusChange({
          ...proposal,
          status: 'approved',
        });
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'APPROVE_ERROR', err?.message || 'Failed to approve proposal'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await apiClient.rejectProposal(proposal.projectId, proposal.proposalId, {
        reason: rejectionReason || undefined,
      });
      setShowRejectModal(false);
      if (onStatusChange) {
        onStatusChange({
          ...proposal,
          status: 'rejected',
        });
      }
    } catch (err: any) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        setError(new ApiError(0, 'REJECT_ERROR', err?.message || 'Failed to reject proposal'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const statusBadgeClass =
    proposal.status === 'approved'
      ? 'badge-approved'
      : proposal.status === 'rejected'
      ? 'badge-rejected'
      : 'badge-pending';

  return (
    <div
      className="card card-hover"
      style={{
        borderLeft: isPending ? '4px solid #f59e0b' : proposal.status === 'approved' ? '4px solid #10b981' : '4px solid #f43f5e',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className={`badge ${statusBadgeClass}`}>{proposal.status}</span>
          <span className="badge badge-purple">{proposal.entityType}</span>
          <span className="badge badge-blue">{proposal.actionClass}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>Version at creation: v{proposal.projectVersionAtCreation}</span>
          <span>•</span>
          <span style={{ fontFamily: 'monospace' }}>ID: {proposal.proposalId}</span>
        </div>
      </div>

      {/* Rationale */}
      {proposal.rationale && (
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
          "{proposal.rationale}"
        </div>
      )}

      {/* Payload Content Details */}
      <div
        style={{
          background: 'var(--bg-input)',
          padding: 14,
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          fontSize: '0.875rem',
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
          Proposed Entity Payload:
        </div>
        <pre
          style={{
            margin: 0,
            color: '#38bdf8',
            fontSize: '0.8125rem',
            overflowX: 'auto',
            whiteSpace: 'pre-wrap',
          }}
        >
          {JSON.stringify(proposal.entityPayload, null, 2)}
        </pre>
      </div>

      {/* Error display */}
      {error && (
        <ErrorAlert
          message={error.message}
          errorCode={error.errorCode}
          requestId={error.requestId}
          onDismiss={() => setError(null)}
        />
      )}

      {/* Action Buttons */}
      {isPending && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <button
            className="btn btn-danger"
            onClick={() => setShowRejectModal(true)}
            disabled={isProcessing}
          >
            ✕ Reject
          </button>
          <button
            className="btn btn-success"
            onClick={handleApprove}
            disabled={isProcessing}
          >
            {isProcessing ? 'Processing...' : '✓ Approve & Commit'}
          </button>
        </div>
      )}

      {/* Rejection Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="Reject Proposal"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Are you sure you want to reject proposal <code style={{ color: '#38bdf8' }}>{proposal.proposalId}</code>?
            This will record a rejection audit event without mutating project entities.
          </p>
          <div>
            <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
              Rejection Reason (Optional):
            </label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Scope out of current sprint, architectural conflict..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowRejectModal(false)} disabled={isProcessing}>
              Cancel
            </button>
            <button className="btn btn-danger" onClick={handleReject} disabled={isProcessing}>
              {isProcessing ? 'Rejecting...' : 'Confirm Rejection'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
