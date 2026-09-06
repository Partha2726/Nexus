/**
 * Flow and integration tests for NEXUS Frontend (Account 2).
 * 
 * Tests:
 * 1. AI Chat multi-turn interaction, proposal cards, unresolved questions.
 * 2. Impact analysis submission, downstream entity display, relation path rendering.
 * 3. Knowledge Graph loading, node/edge rendering, empty state.
 * 4. Stale version concurrency UX.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChatView } from '../components/chat/ChatView';
import { ImpactView } from '../components/impact/ImpactView';
import { GraphCanvas } from '../components/graph/GraphCanvas';
import { ProposalCard } from '../components/proposals/ProposalCard';
import { Proposal } from '../lib/contracts';
import { apiClient, ApiError } from '../lib/api-client';

describe('ChatView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders chat interface and sends user message', async () => {
    const chatSpy = vi.spyOn(apiClient, 'sendChatMessage').mockResolvedValueOnce({
      conversationId: 'conv-new-1',
      messageId: 'msg-ast-1',
      response: 'I have analyzed your requirement specification.',
      agentType: 'requirements',
      proposals: [
        {
          proposalId: 'prop-chat-1',
          projectId: 'proj-1',
          runId: 'run-1',
          actionClass: 'PROPOSE',
          entityType: 'requirement',
          entityPayload: {
            statement: 'System shall enforce rate limiting of 100 req/min',
          },
          affectedEntityIds: [],
          confidence: 'high',
          rationale: 'Protect against DDoS',
          status: 'pending',
          projectVersionAtCreation: 1,
          createdAt: '2026-09-06T10:00:00Z',
        },
      ],
      unresolvedQuestions: ['What is the burst tolerance limit?'],
      runId: 'run-1',
    });

    render(<ChatView projectId="proj-1" />);

    // Check placeholder
    const input = screen.getByPlaceholderText(/Type an engineering requirement/i);
    fireEvent.change(input, { target: { value: 'Add rate limiting requirement' } });

    const sendBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendBtn);

    // Verify user message appears in feed
    expect(screen.getByText('Add rate limiting requirement')).toBeInTheDocument();

    await waitFor(() => {
      expect(chatSpy).toHaveBeenCalledWith('proj-1', {
        conversationId: undefined,
        message: 'Add rate limiting requirement',
      });
      // Assistant message rendered
      expect(screen.getByText('I have analyzed your requirement specification.')).toBeInTheDocument();
      // Unresolved questions rendered
      expect(screen.getByText('What is the burst tolerance limit?')).toBeInTheDocument();
      // Proposal card rendered
      expect(screen.getByText(/ID: prop-chat-1/i)).toBeInTheDocument();
    });
  });

  it('displays structured error when chat service fails', async () => {
    vi.spyOn(apiClient, 'sendChatMessage').mockRejectedValueOnce(
      new ApiError(503, 'AI_UNAVAILABLE', 'Gemini quota exceeded. Please retry shortly.')
    );

    render(<ChatView projectId="proj-1" />);

    const input = screen.getByPlaceholderText(/Type an engineering requirement/i);
    fireEvent.change(input, { target: { value: 'Test failure' } });

    const sendBtn = screen.getByRole('button', { name: /send/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(screen.getByText(/Gemini quota exceeded/i)).toBeInTheDocument();
      expect(screen.getByText('AI_UNAVAILABLE')).toBeInTheDocument();
    });
  });
});

describe('ImpactView Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('submits impact analysis request and renders affected entities with relation paths', async () => {
    const impactSpy = vi.spyOn(apiClient, 'analyzeImpact').mockResolvedValueOnce({
      projectId: 'proj-1',
      changedEntityType: 'requirement',
      changedEntityId: 'req-auth',
      affectedEntities: [
        {
          entityType: 'component',
          entityId: 'comp-auth',
          relationPath: ['IMPLEMENTS'],
          label: 'AuthService',
        },
        {
          entityType: 'task',
          entityId: 'task-auth-token',
          relationPath: ['IMPLEMENTS', 'GENERATES'],
          label: 'Implement Token Verifier',
        },
      ],
      explanation: 'AuthService and Token Verifier directly depend on req-auth.',
      runId: 'run-impact-1',
    });

    render(<ImpactView projectId="proj-1" />);

    const input = screen.getByPlaceholderText(/Enter exact entity ID/i);
    fireEvent.change(input, { target: { value: 'req-auth' } });

    const analyzeBtn = screen.getByRole('button', { name: /run impact analysis/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(impactSpy).toHaveBeenCalledWith('proj-1', {
        entityType: 'requirement',
        entityId: 'req-auth',
      });
      // Header summary
      expect(screen.getByText(/2 Downstream Entities/i)).toBeInTheDocument();
      // Explanation
      expect(screen.getByText(/AuthService and Token Verifier directly depend on req-auth/i)).toBeInTheDocument();
      // Affected entities
      expect(screen.getByText('AuthService')).toBeInTheDocument();
      expect(screen.getByText('Implement Token Verifier')).toBeInTheDocument();
      // Relation path items
      expect(screen.getAllByText('IMPLEMENTS').length).toBeGreaterThan(0);
      expect(screen.getByText('GENERATES')).toBeInTheDocument();
    });
  });

  it('renders empty impact state when no downstream links exist', async () => {
    vi.spyOn(apiClient, 'analyzeImpact').mockResolvedValueOnce({
      projectId: 'proj-1',
      changedEntityType: 'requirement',
      changedEntityId: 'req-isolated',
      affectedEntities: [],
      explanation: '',
      runId: 'run-isolated-1',
    });

    render(<ImpactView projectId="proj-1" />);

    const input = screen.getByPlaceholderText(/Enter exact entity ID/i);
    fireEvent.change(input, { target: { value: 'req-isolated' } });

    const analyzeBtn = screen.getByRole('button', { name: /run impact analysis/i });
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByText(/No Downstream Impact Detected/i)).toBeInTheDocument();
    });
  });
});

describe('GraphCanvas Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders knowledge graph nodes, edges and interactive selection', async () => {
    vi.spyOn(apiClient, 'getProjectGraph').mockResolvedValueOnce({
      projectId: 'proj-1',
      nodes: [
        { id: 'req-1', type: 'requirement', label: 'OAuth2 Requirement', data: { priority: 'must' } },
        { id: 'comp-1', type: 'component', label: 'AuthService', data: { tech: 'FastAPI' } },
      ],
      edges: [
        { id: 'tl-1', source: 'comp-1', target: 'req-1', relation: 'IMPLEMENTS', label: 'IMPLEMENTS' },
      ],
    });

    render(<GraphCanvas projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText(/OAuth2 Requirement/i)).toBeInTheDocument();
      expect(screen.getByText(/AuthService/i)).toBeInTheDocument();
      expect(screen.getByText('IMPLEMENTS')).toBeInTheDocument();
    });

    // Click on a node to select it
    const reqNode = screen.getByText(/OAuth2 Requirement/i);
    fireEvent.click(reqNode);

    // Inspector panel should open
    await waitFor(() => {
      expect(screen.getByText(/Connected Trace Links/i)).toBeInTheDocument();
    });
  });

  it('renders empty state when graph has no nodes', async () => {
    vi.spyOn(apiClient, 'getProjectGraph').mockResolvedValueOnce({
      projectId: 'proj-1',
      nodes: [],
      edges: [],
    });

    render(<GraphCanvas projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText(/No Knowledge Graph Available/i)).toBeInTheDocument();
    });
  });

  it('handles graph error state gracefully', async () => {
    vi.spyOn(apiClient, 'getProjectGraph').mockRejectedValueOnce(
      new ApiError(500, 'INTERNAL_ERROR', 'Failed to traverse graph index')
    );

    render(<GraphCanvas projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to traverse graph index/i)).toBeInTheDocument();
    });
  });
});

describe('ProposalCard Concurrency & Authorization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const staleProposal: Proposal = {
    proposalId: 'prop-stale-1',
    projectId: 'proj-1',
    runId: 'run-1',
    actionClass: 'PROPOSE',
    entityType: 'requirement',
    entityPayload: { statement: 'Old statement' },
    affectedEntityIds: [],
    confidence: 'medium',
    rationale: 'Initial draft',
    status: 'pending',
    projectVersionAtCreation: 1,
    createdAt: '2026-09-06T10:00:00Z',
  };

  it('displays distinct STALE_VERSION concurrency error banner when approval returns 409', async () => {
    vi.spyOn(apiClient, 'approveProposal').mockRejectedValueOnce(
      new ApiError(409, 'STALE_VERSION', 'Proposal created at version 1, but current project version is 2')
    );

    render(<ProposalCard proposal={staleProposal} />);

    const approveBtn = screen.getByRole('button', { name: /approve & commit/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByText(/STALE_VERSION/i)).toBeInTheDocument();
      expect(screen.getByText(/Proposal created at version 1, but current project version is 2/i)).toBeInTheDocument();
    });
  });

  it('displays authorization error when user lacks permission to approve (403)', async () => {
    vi.spyOn(apiClient, 'approveProposal').mockRejectedValueOnce(
      new ApiError(403, 'FORBIDDEN', 'User is not the project owner')
    );

    render(<ProposalCard proposal={staleProposal} />);

    const approveBtn = screen.getByRole('button', { name: /approve & commit/i });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByText(/FORBIDDEN/i)).toBeInTheDocument();
      expect(screen.getByText(/User is not the project owner/i)).toBeInTheDocument();
    });
  });

  it('renders already-approved proposal without action buttons', () => {
    const approvedProp: Proposal = {
      ...staleProposal,
      status: 'approved',
    };

    render(<ProposalCard proposal={approvedProp} />);

    expect(screen.getByText('approved')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /approve & commit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reject/i })).not.toBeInTheDocument();
  });
});

